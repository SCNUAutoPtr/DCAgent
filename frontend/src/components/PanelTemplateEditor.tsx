import { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Space,
  message,
  Divider,
} from 'antd';
import {
  SaveOutlined,
} from '@ant-design/icons';
import { PanelType } from '@/types';
import PanelCanvasEditor, { PortDefinition } from './PanelCanvasEditor';

interface PortGroup {
  id: string;
  name: string;
  portNumbers: string[];
  color: string;
}

interface PanelTemplateEditorProps {
  templateId?: string;
  templateName: string;
  panelType: PanelType;
  portCount: number;
  width: number;
  height: number;
  initialPorts: PortDefinition[];
  onSave: (ports: PortDefinition[], groups: PortGroup[]) => void;
  onCancel: () => void;
}

export default function PanelTemplateEditor({
  templateName,
  panelType,
  portCount,
  width,
  height,
  initialPorts,
  onSave,
  onCancel,
}: PanelTemplateEditorProps) {
  const [ports, setPorts] = useState<PortDefinition[]>(initialPorts);

  useEffect(() => {
    setPorts(initialPorts);
  }, [initialPorts]);

  const handleSave = () => {
    onSave(ports, []); // 暂时不保存端口组
    message.success('模板已保存');
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small">
        <Space>
          <span><strong>模板名称:</strong> {templateName}</span>
          <span><strong>面板类型:</strong> {panelType}</span>
          <span><strong>端口总数:</strong> {portCount}</span>
          <span><strong>尺寸:</strong> {width}mm × {height}mm</span>
        </Space>
      </Card>

      <Divider />

      {/* 使用 PanelCanvasEditor 作为核心编辑器 */}
      <PanelCanvasEditor
        width={width}
        height={height}
        backgroundColor="#FFFFFF"
        initialPorts={ports}
        onPortsChange={setPorts}
        readOnly={false}
      />

      <Divider />

      <Card size="small">
        <Space>
          <Button type="default" onClick={onCancel}>
            取消
          </Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            保存模板
          </Button>
        </Space>
      </Card>
    </Space>
  );
}
