import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Card, Alert, Tabs, Space, Button, Modal, Form, Select, message } from 'antd';
import {
  CloudUploadOutlined,
  DatabaseOutlined,
  ApartmentOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { PanelTemplate, Device, Cabinet } from '@/types';
import { panelTemplateService } from '@/services/panelTemplateService';
import { deviceService } from '@/services/deviceService';
import { cabinetService } from '@/services/cabinetService';
import BulkImportModal, { BulkImportColumn } from '@/components/BulkImportModal';

const { Title, Paragraph } = Typography;
const { TabPane } = Tabs;

/**
 * 批量上架页面
 * 用于批量初始化新购买的服务器和设备
 */
export default function BulkDeploymentPage() {
  const { t } = useTranslation('management');
  const [templates, setTemplates] = useState<PanelTemplate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [cabinets, setCabinets] = useState<Cabinet[]>([]);
  const [templateModalVisible, setTemplateModalVisible] = useState(false);
  const [deviceImportVisible, setDeviceImportVisible] = useState(false);
  const [cableImportVisible, setCableImportVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
    loadDevices();
    loadCabinets();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await panelTemplateService.getAll();
      setTemplates(data);
    } catch (error: any) {
      message.error(t('bulkDeployment.messages.loadTemplatesFailed') + ': ' + error.message);
    }
  };

  const loadDevices = async () => {
    try {
      const data = await deviceService.getAll();
      setDevices(data);
    } catch (error: any) {
      message.error(t('bulkDeployment.messages.loadDevicesFailed') + ': ' + error.message);
    }
  };

  const loadCabinets = async () => {
    try {
      const data = await cabinetService.getAll();
      setCabinets(data);
    } catch (error: any) {
      message.error(t('bulkDeployment.messages.loadCabinetsFailed') + ': ' + error.message);
    }
  };

  const handleCreateFromTemplate = () => {
    form.resetFields();
    setTemplateModalVisible(true);
  };

  const handleTemplateSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { templateId, deviceId } = values;

      await panelTemplateService.createPanelFromTemplate(templateId, deviceId);
      message.success(t('bulkDeployment.messages.createPanelSuccess'));
      setTemplateModalVisible(false);
      form.resetFields();
    } catch (error: any) {
      message.error(t('bulkDeployment.messages.createPanelFailed') + ': ' + error.message);
    }
  };

  // 设备导入列配置
  const deviceColumns: BulkImportColumn[] = [
    {
      title: t('bulkDeployment.fields.deviceName'),
      dataIndex: 'name',
      key: 'name',
      required: true,
      validator: (value) => {
        if (typeof value !== 'string' || value.trim().length === 0) {
          return t('bulkDeployment.validation.deviceNameRequired');
        }
        return null;
      },
    },
    {
      title: t('bulkDeployment.fields.deviceType'),
      dataIndex: 'type',
      key: 'type',
      required: true,
      validator: (value) => {
        const validTypes = ['SERVER', 'SWITCH', 'ROUTER', 'FIREWALL', 'STORAGE', 'PDU', 'OTHER'];
        if (!validTypes.includes(value)) {
          return t('bulkDeployment.validation.deviceTypeRequired', { types: validTypes.join(', ') });
        }
        return null;
      },
    },
    {
      title: t('bulkDeployment.fields.model'),
      dataIndex: 'model',
      key: 'model',
      required: false,
    },
    {
      title: t('bulkDeployment.fields.serialNo'),
      dataIndex: 'serialNo',
      key: 'serialNo',
      required: false,
    },
    {
      title: t('bulkDeployment.fields.cabinetId'),
      dataIndex: 'cabinetId',
      key: 'cabinetId',
      required: true,
      validator: (value) => {
        if (!cabinets.find(c => c.id === value)) {
          return t('bulkDeployment.validation.cabinetIdRequired');
        }
        return null;
      },
    },
    {
      title: t('bulkDeployment.fields.uPosition'),
      dataIndex: 'uPosition',
      key: 'uPosition',
      required: false,
      validator: (value) => {
        if (value && (typeof value !== 'number' || value < 1 || value > 42)) {
          return t('bulkDeployment.validation.uPositionInvalid');
        }
        return null;
      },
    },
    {
      title: t('bulkDeployment.fields.uHeight'),
      dataIndex: 'uHeight',
      key: 'uHeight',
      required: false,
      validator: (value) => {
        if (value && (typeof value !== 'number' || value < 1)) {
          return t('bulkDeployment.validation.uHeightInvalid');
        }
        return null;
      },
    },
  ];

  // 设备导入模板数据
  const deviceTemplateData = [
    {
      设备名称: 'SV-001',
      设备类型: 'SERVER',
      型号: 'Dell PowerEdge R740',
      序列号: 'SN123456',
      机柜ID: cabinets[0]?.id || '请填写有效的机柜ID',
      U位位置: 10,
      U高度: 2,
    },
    {
      设备名称: 'SW-001',
      设备类型: 'SWITCH',
      型号: 'Cisco Catalyst 9300',
      序列号: 'SN789012',
      机柜ID: cabinets[0]?.id || '请填写有效的机柜ID',
      U位位置: 40,
      U高度: 1,
    },
  ];

  // 线缆导入列配置
  const cableColumns: BulkImportColumn[] = [
    {
      title: t('bulkDeployment.fields.cableLabel'),
      dataIndex: 'label',
      key: 'label',
      required: false,
    },
    {
      title: t('bulkDeployment.fields.cableType'),
      dataIndex: 'type',
      key: 'type',
      required: true,
      validator: (value) => {
        const validTypes = ['CAT5E', 'CAT6', 'CAT6A', 'FIBER_SM', 'FIBER_MM', 'DAC', 'AOC', 'QSFP', 'OTHER'];
        if (!validTypes.includes(value)) {
          return t('bulkDeployment.validation.cableTypeRequired', { types: validTypes.join(', ') });
        }
        return null;
      },
    },
    {
      title: t('bulkDeployment.fields.cableLength'),
      dataIndex: 'length',
      key: 'length',
      required: false,
      validator: (value) => {
        if (value && (typeof value !== 'number' || value <= 0)) {
          return t('bulkDeployment.validation.cableLengthInvalid');
        }
        return null;
      },
    },
    {
      title: t('bulkDeployment.fields.cableColor'),
      dataIndex: 'color',
      key: 'color',
      required: false,
    },
    {
      title: t('bulkDeployment.fields.notes'),
      dataIndex: 'notes',
      key: 'notes',
      required: false,
    },
    {
      title: t('bulkDeployment.fields.portAId'),
      dataIndex: 'portAId',
      key: 'portAId',
      required: true,
    },
    {
      title: t('bulkDeployment.fields.portBId'),
      dataIndex: 'portBId',
      key: 'portBId',
      required: true,
    },
  ];

  // 线缆导入模板数据
  const cableTemplateData = [
    {
      标签: 'CABLE-001',
      线缆类型: 'CAT6',
      '长度(米)': 3,
      颜色: '蓝色',
      备注: '服务器到交换机',
      '端口A ID': '请填写有效的端口ID',
      '端口B ID': '请填写有效的端口ID',
    },
  ];

  // 处理设备批量导入
  const handleDeviceImport = async (data: any[]) => {
    try {
      const result = await deviceService.bulkCreate(data);

      if (result.data.failed.length > 0) {
        Modal.warning({
          title: t('bulkDeployment.messages.partialImportFailed'),
          content: (
            <div>
              <p>{t('bulkDeployment.table.successCount', { count: result.data.success.length })}</p>
              <p>{t('bulkDeployment.table.failedCount', { count: result.data.failed.length })}</p>
              <ul>
                {result.data.failed.map((f: any) => (
                  <li key={f.index}>
                    {t('bulkDeployment.table.rowError', { row: f.index, error: f.error })}
                  </li>
                ))}
              </ul>
            </div>
          ),
        });
      }

      await loadDevices();
    } catch (error: any) {
      throw new Error(error.response?.data?.error || error.message);
    }
  };

  // 处理线缆批量导入（待实现后端API）
  const handleCableImport = async (data: any[]) => {
    message.info(t('bulkDeployment.messages.importDevicesCablesDeveloping'));
    console.log('Cable import data:', data);
  };

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <CloudUploadOutlined /> {t('bulkDeployment.title')}
          </Title>
          <Paragraph type="secondary">
            {t('bulkDeployment.description')}
          </Paragraph>
        </div>

        <Alert
          message={t('bulkDeployment.alerts.assistantTitle')}
          description={t('bulkDeployment.alerts.assistantDescription')}
          type="info"
          showIcon
        />

        <Tabs defaultActiveKey="devices" type="card">
          <TabPane
            tab={
              <span>
                <DatabaseOutlined />
                {t('bulkDeployment.tabs.devices')}
              </span>
            }
            key="devices"
          >
            <Card>
              <Title level={4}>{t('bulkDeployment.sections.devicesTitle')}</Title>
              <Paragraph>
                {t('bulkDeployment.sections.devicesDescription')}
              </Paragraph>
              <ul>
                {t('bulkDeployment.sections.devicesFeatures', { returnObjects: true }).map((feature: string, idx: number) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <Button
                type="primary"
                onClick={() => setDeviceImportVisible(true)}
              >
                {t('bulkDeployment.actions.importDevices')}
              </Button>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <ApartmentOutlined />
                {t('bulkDeployment.tabs.panels')}
              </span>
            }
            key="panels"
          >
            <Card>
              <Title level={4}>{t('bulkDeployment.sections.panelsTitle')}</Title>
              <Paragraph>
                {t('bulkDeployment.sections.panelsDescription')}
              </Paragraph>
              <ul>
                {t('bulkDeployment.sections.panelsFeatures', { returnObjects: true }).map((feature: string, idx: number) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <Button type="primary" onClick={handleCreateFromTemplate}>
                {t('bulkDeployment.actions.createFromTemplate')}
              </Button>
            </Card>
          </TabPane>

          <TabPane
            tab={
              <span>
                <LinkOutlined />
                {t('bulkDeployment.tabs.cables')}
              </span>
            }
            key="cables"
          >
            <Card>
              <Title level={4}>{t('bulkDeployment.sections.cablesTitle')}</Title>
              <Paragraph>
                {t('bulkDeployment.sections.cablesDescription')}
              </Paragraph>
              <ul>
                {t('bulkDeployment.sections.cablesFeatures', { returnObjects: true }).map((feature: string, idx: number) => (
                  <li key={idx}>{feature}</li>
                ))}
              </ul>
              <Button
                type="primary"
                onClick={() => setCableImportVisible(true)}
              >
                {t('bulkDeployment.actions.importCables')}
              </Button>
            </Card>
          </TabPane>
        </Tabs>

        <Alert
          message={t('bulkDeployment.alerts.tipsTitle')}
          description={t('bulkDeployment.alerts.tipsDescription')}
          type="warning"
          showIcon
        />
      </Space>

      {/* 从模板创建面板 Modal */}
      <Modal
        title={t('bulkDeployment.modals.createFromTemplate')}
        open={templateModalVisible}
        onOk={handleTemplateSubmit}
        onCancel={() => setTemplateModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="templateId"
            label={t('bulkDeployment.formLabels.selectTemplate')}
            rules={[{ required: true, message: t('bulkDeployment.formLabels.selectTemplate') }]}
          >
            <Select placeholder={t('bulkDeployment.formPlaceholders.selectTemplate')}>
              {templates.map((template) => (
                <Select.Option key={template.id} value={template.id}>
                  {template.name} ({template.type} - {template.portCount}口)
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="deviceId"
            label={t('bulkDeployment.formLabels.selectDevice')}
            rules={[{ required: true, message: t('bulkDeployment.formLabels.selectDevice') }]}
          >
            <Select placeholder={t('bulkDeployment.formPlaceholders.selectDevice')}>
              {devices.map((device) => (
                <Select.Option key={device.id} value={device.id}>
                  {device.name} ({device.type})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 设备批量导入 Modal */}
      <BulkImportModal
        visible={deviceImportVisible}
        title={t('bulkDeployment.modals.importDevices')}
        columns={deviceColumns}
        templateData={deviceTemplateData}
        onCancel={() => setDeviceImportVisible(false)}
        onSubmit={handleDeviceImport}
      />

      {/* 线缆批量导入 Modal */}
      <BulkImportModal
        visible={cableImportVisible}
        title={t('bulkDeployment.modals.importCables')}
        columns={cableColumns}
        templateData={cableTemplateData}
        onCancel={() => setCableImportVisible(false)}
        onSubmit={handleCableImport}
      />
    </div>
  );
}
