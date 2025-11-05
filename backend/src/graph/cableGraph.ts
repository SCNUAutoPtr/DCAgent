import neo4jConnection from './neo4j';

export interface CableConnection {
  cableId: string;
  portAId: string;
  portBId: string;
}

export interface ConnectionQueryResult {
  cable: {
    id: string;
    label?: string;
    type: string;
    color?: string;
  };
  portA: {
    id: string;
    number: string;
    label?: string;
  };
  portB: {
    id: string;
    number: string;
    label?: string;
  };
}

class CableGraphService {
  /**
   * 创建线缆连接关系
   */
  async createConnection(connection: CableConnection): Promise<void> {
    const session = neo4jConnection.getSession();
    try {
      await session.run(
        `
        MERGE (portA:Port {id: $portAId})
        MERGE (portB:Port {id: $portBId})
        MERGE (cable:Cable {id: $cableId})
        MERGE (portA)-[:CONNECTED_BY]->(cable)
        MERGE (cable)-[:CONNECTED_BY]->(portB)
        `,
        connection
      );
    } finally {
      await session.close();
    }
  }

  /**
   * 删除线缆连接关系
   */
  async deleteConnection(cableId: string): Promise<void> {
    const session = neo4jConnection.getSession();
    try {
      await session.run(
        `
        MATCH (cable:Cable {id: $cableId})
        DETACH DELETE cable
        `,
        { cableId }
      );
    } finally {
      await session.close();
    }
  }

  /**
   * 查询端口的另一端
   */
  async findConnectedPort(portId: string): Promise<string | null> {
    const session = neo4jConnection.getSession();
    try {
      const result = await session.run(
        `
        MATCH (port1:Port {id: $portId})-[:CONNECTED_BY]->
              (cable:Cable)-[:CONNECTED_BY]->(port2:Port)
        RETURN port2.id as connectedPortId
        `,
        { portId }
      );

      if (result.records.length > 0) {
        return result.records[0].get('connectedPortId');
      }
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * 获取线缆连接的两个端口ID
   */
  async getCablePortIds(cableId: string): Promise<string[] | null> {
    const session = neo4jConnection.getSession();
    try {
      const result = await session.run(
        `
        MATCH (portA:Port)-[:CONNECTED_BY]->(cable:Cable {id: $cableId})
              -[:CONNECTED_BY]->(portB:Port)
        RETURN portA.id as portAId, portB.id as portBId
        `,
        { cableId }
      );

      if (result.records.length > 0) {
        const record = result.records[0];
        return [
          record.get('portAId'),
          record.get('portBId')
        ];
      }
      return null;
    } finally {
      await session.close();
    }
  }

  /**
   * 查询面板的所有连接关系（双向）
   */
  async findPanelConnections(panelId: string): Promise<ConnectionQueryResult[]> {
    const session = neo4jConnection.getSession();
    try {
      const result = await session.run(
        `
        MATCH (panel1:Panel {id: $panelId})-[:HAS_PORT]->(port1:Port)
              -[:CONNECTED_BY]-(cable:Cable)-[:CONNECTED_BY]-(port2:Port)
              <-[:HAS_PORT]-(panel2:Panel)
        WHERE panel1 <> panel2
        RETURN DISTINCT cable, port1, port2, panel2
        `,
        { panelId }
      );

      return result.records.map(record => ({
        cable: record.get('cable').properties,
        portA: record.get('port1').properties,
        portB: record.get('port2').properties,
      }));
    } finally {
      await session.close();
    }
  }

  /**
   * 查询网状拓扑（从某个面板出发的所有关联面板）
   */
  async findNetworkTopology(panelId: string, maxDepth: number = 3) {
    const session = neo4jConnection.getSession();
    try {
      const result = await session.run(
        `
        MATCH path = (panel1:Panel {id: $panelId})-[:HAS_PORT]->(:Port)
                     -[:CONNECTED_BY*1..${maxDepth * 2}]-(:Port)
                     <-[:HAS_PORT]-(panel2:Panel)
        RETURN path
        `,
        { panelId }
      );

      // 这里需要进一步处理path数据，转换为前端需要的格式
      return result.records.map(record => record.get('path'));
    } finally {
      await session.close();
    }
  }

  /**
   * 同步端口和面板节点信息到Neo4j
   */
  async syncPortNode(portId: string, portData: any): Promise<void> {
    const session = neo4jConnection.getSession();
    try {
      // 创建/更新 Port 节点
      await session.run(
        `
        MERGE (port:Port {id: $portId})
        SET port.number = $number,
            port.label = $label,
            port.panelId = $panelId
        `,
        {
          portId,
          number: portData.number,
          label: portData.label,
          panelId: portData.panelId,
        }
      );

      // 创建 HAS_PORT 关系（如果 panelId 存在）
      if (portData.panelId) {
        await session.run(
          `
          MATCH (panel:Panel {id: $panelId}), (port:Port {id: $portId})
          MERGE (panel)-[:HAS_PORT]->(port)
          `,
          {
            panelId: portData.panelId,
            portId,
          }
        );
      }
    } finally {
      await session.close();
    }
  }

  async syncPanelNode(panelId: string, panelData: any): Promise<void> {
    const session = neo4jConnection.getSession();
    try {
      await session.run(
        `
        MERGE (panel:Panel {id: $panelId})
        SET panel.name = $name,
            panel.type = $type,
            panel.deviceId = $deviceId
        WITH panel
        MATCH (port:Port {panelId: $panelId})
        MERGE (panel)-[:HAS_PORT]->(port)
        `,
        {
          panelId,
          name: panelData.name,
          type: panelData.type,
          deviceId: panelData.deviceId,
        }
      );
    } finally {
      await session.close();
    }
  }
}

export default new CableGraphService();
