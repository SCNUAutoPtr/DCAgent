import neo4jConnection from '../src/graph/neo4j';

async function checkConnection() {
  const session = neo4jConnection.getSession();

  try {
    const panelId23 = '5e62b4d6-2550-4462-9905-9b15ffc6f235';

    const result = await session.run(`
      MATCH (panel1:Panel {id: $panelId})-[:HAS_PORT]->(port1:Port)
            -[:CONNECTED_BY]-(cable:Cable)-[:CONNECTED_BY]-(port2:Port)
            <-[:HAS_PORT]-(panel2:Panel)
      WHERE panel1 <> panel2
      RETURN panel2.name as panelName, panel2.shortId as shortId,
             port1.number as port1Number, port2.number as port2Number,
             cable.type as cableType
    `, { panelId: panelId23 });

    console.log('E-00023 的连接情况：');
    if (result.records.length === 0) {
      console.log('✗ 未找到连接');
    } else {
      result.records.forEach(record => {
        const shortId = record.get('shortId');
        const panelName = record.get('panelName');
        console.log(`  端口 ${record.get('port1Number')} -> (${record.get('cableType')}) -> 端口 ${record.get('port2Number')} @ ${panelName} (shortId: ${shortId})`);
        if (shortId === 22) {
          console.log('  ✓ 找到了到E-00022的连接！');
        }
      });
    }

  } finally {
    await session.close();
  }
}

checkConnection().catch(console.error);
