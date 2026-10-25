import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Card, Form, Modal, Select, Space, Tabs, Typography, message } from 'antd';
import { ApartmentOutlined, CloudUploadOutlined, DatabaseOutlined, LinkOutlined } from '@ant-design/icons';
import type { DeviceDto } from '@contracts/devices';
import { CABLE_MEDIA, DEVICE_TYPES, type CableMedium, type DeviceType } from '@contracts/enums';
import type { CabinetDto } from '@contracts/hierarchy';
import type { PanelTemplateDto } from '@contracts/panelTemplates';
import { panelTemplateService } from '@/services/panelTemplateService';
import { deviceService } from '@/services/deviceService';
import { cabinetService } from '@/services/hierarchyService';
import { cableService } from '@/services/cableService';
import { ApiError, errorText } from '@/services/api';
import BulkImportModal, { type BulkImportColumn, type Cell, type ImportRow } from '@/components/BulkImportModal';
import { PanelView } from '@/components/panel/PanelView';
import type management from '@/locales/zh-CN/management.json';
import { parseLabelInput } from '@/utils/labels';

const { Title, Paragraph } = Typography;

type BulkLocale = (typeof management)['bulkDeployment'];

const str = (v: Cell) => (v === undefined || v === null ? undefined : String(v).trim() || undefined);
const num = (v: Cell) => (v === undefined || v === null || v === '' ? undefined : Number(v));
const labelOk = (v: Cell) => {
  try {
    parseLabelInput(v);
    return true;
  } catch {
    return false;
  }
};

export default function BulkDeploymentPage() {
  const { t } = useTranslation(['management', 'device', 'cable', 'panel']);
  const [templates, setTemplates] = useState<PanelTemplateDto[]>([]);
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [cabinets, setCabinets] = useState<CabinetDto[]>([]);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [deviceImportOpen, setDeviceImportOpen] = useState(false);
  const [cableImportOpen, setCableImportOpen] = useState(false);
  const [preview, setPreview] = useState<PanelTemplateDto | null>(null);
  const [form] = Form.useForm<{ templateId: string; deviceId: string }>();

  const load = useCallback(() => {
    panelTemplateService.list().then(setTemplates, () => undefined);
    deviceService.list().then(setDevices, () => undefined);
    cabinetService.list().then(setCabinets, () => undefined);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // a cabinet can be given by id or by name
  const cabinetByKey = useMemo(() => {
    const m = new Map<string, CabinetDto>();
    for (const c of cabinets) {
      m.set(c.id, c);
      m.set(c.name, c);
    }
    return m;
  }, [cabinets]);

  const pickTemplate = async (templateId: string) => {
    try {
      setPreview(await panelTemplateService.get({ id: templateId }));
    } catch {
      setPreview(null);
    }
  };

  const createFromTemplate = async () => {
    const v = await form.validateFields();
    try {
      await panelTemplateService.createPanel({ templateId: v.templateId, deviceId: v.deviceId });
      message.success(t('management:bulkDeployment.messages.createPanelSuccess'));
      setTemplateOpen(false);
    } catch {
      // reported by rpc
    }
  };

  const f = (key: keyof BulkLocale['fields']) => t(`management:bulkDeployment.fields.${key}`);
  const v = (key: keyof BulkLocale['validation'], opts?: Record<string, string>) => t(`management:bulkDeployment.validation.${key}`, opts);

  const deviceColumns: BulkImportColumn[] = [
    { title: f('deviceName'), dataIndex: 'name', required: true },
    {
      title: f('deviceType'),
      dataIndex: 'type',
      required: true,
      validator: (x) => ((DEVICE_TYPES as readonly string[]).includes(String(x)) ? null : v('deviceTypeRequired', { types: DEVICE_TYPES.join(', ') })),
    },
    { title: f('serialNo'), dataIndex: 'serialNo' },
    { title: f('cabinetId'), dataIndex: 'cabinet', required: true, validator: (x) => (cabinetByKey.has(String(x)) ? null : v('cabinetIdRequired')) },
    { title: f('uPosition'), dataIndex: 'uPosition', validator: (x) => (Number.isInteger(Number(x)) && Number(x) >= 1 && Number(x) <= 60 ? null : v('uPositionInvalid')) },
    { title: f('uHeight'), dataIndex: 'uHeight', validator: (x) => (Number.isInteger(Number(x)) && Number(x) >= 1 ? null : v('uHeightInvalid')) },
  ];
  const deviceTemplateRows: ImportRow[] = [
    { name: 'SV-001', type: 'SERVER', serialNo: 'SN123456', cabinet: cabinets[0]?.name ?? '', uPosition: 10, uHeight: 2 },
    { name: 'SW-001', type: 'SWITCH', serialNo: 'SN789012', cabinet: cabinets[0]?.name ?? '', uPosition: 40, uHeight: 1 },
  ];

  const cableColumns: BulkImportColumn[] = [
    { title: f('cableLabel'), dataIndex: 'label' },
    {
      title: f('cableType'),
      dataIndex: 'medium',
      required: true,
      validator: (x) => ((CABLE_MEDIA as readonly string[]).includes(String(x)) ? null : v('cableTypeRequired', { types: CABLE_MEDIA.join(', ') })),
    },
    { title: f('cableLength'), dataIndex: 'lengthM', validator: (x) => (Number(x) > 0 ? null : v('cableLengthInvalid')) },
    { title: f('cableColor'), dataIndex: 'color' },
    { title: f('notes'), dataIndex: 'notes' },
    { title: f('portAId'), dataIndex: 'portA', required: true },
    { title: f('labelA'), dataIndex: 'labelA', validator: (x) => (labelOk(x) ? null : v('labelInvalid')) },
    { title: f('portBId'), dataIndex: 'portB', required: true },
    { title: f('labelB'), dataIndex: 'labelB', validator: (x) => (labelOk(x) ? null : v('labelInvalid')) },
  ];
  const cableTemplateRows: ImportRow[] = [{ label: 'CABLE-001', medium: 'CAT6', lengthM: 3, color: 'blue', notes: '', portA: '', labelA: '', portB: '', labelB: '' }];

  /** One transaction on the server: all devices or none. */
  const importDevices = async (rows: ImportRow[]) => {
    await deviceService.bulkCreate({
      devices: rows.map((r) => ({
        name: str(r.name)!,
        type: str(r.type) as DeviceType,
        serialNo: str(r.serialNo),
        cabinetId: cabinetByKey.get(String(r.cabinet))!.id,
        uPosition: num(r.uPosition),
        uHeight: num(r.uHeight),
      })),
    });
    message.success(t('management:bulkDeployment.messages.importSuccess'));
    load();
  };

  /** Cables go one by one so one bad row does not block the rest; failures are listed. */
  const importCables = async (rows: ImportRow[]) => {
    const failed: { row: number; error: string }[] = [];
    for (const [i, r] of rows.entries()) {
      try {
        await cableService.create(
          {
            medium: str(r.medium) as CableMedium,
            label: str(r.label),
            lengthM: num(r.lengthM),
            color: str(r.color),
            notes: str(r.notes),
            ends: {
              A: { portId: str(r.portA), labelShortId: parseLabelInput(r.labelA) },
              B: { portId: str(r.portB), labelShortId: parseLabelInput(r.labelB) },
            },
          },
          { silent: true },
        );
      } catch (e) {
        failed.push({ row: i + 1, error: e instanceof ApiError ? errorText(e) : String(e) });
      }
    }
    const ok = rows.length - failed.length;
    if (failed.length) {
      Modal.warning({
        title: t('management:bulkDeployment.messages.cablesImported', { ok, failed: failed.length }),
        content: (
          <ul>
            {failed.map((x) => (
              <li key={x.row}>{t('management:bulkDeployment.table.rowError', { row: x.row, error: x.error })}</li>
            ))}
          </ul>
        ),
      });
    } else message.success(t('management:bulkDeployment.messages.cablesImported', { ok, failed: 0 }));
  };

  const features = (key: 'devicesFeatures' | 'panelsFeatures' | 'cablesFeatures') => t(`management:bulkDeployment.sections.${key}`, { returnObjects: true });

  const section = (key: 'devices' | 'panels' | 'cables', action: React.ReactNode) => (
    <Card>
      <Title level={4}>{t(`management:bulkDeployment.sections.${key}Title`)}</Title>
      <Paragraph>{t(`management:bulkDeployment.sections.${key}Description`)}</Paragraph>
      <ul>
        {features(`${key}Features`).map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      {action}
    </Card>
  );

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>
            <CloudUploadOutlined /> {t('management:bulkDeployment.title')}
          </Title>
          <Paragraph type="secondary">{t('management:bulkDeployment.description')}</Paragraph>
        </div>
        <Alert message={t('management:bulkDeployment.alerts.assistantTitle')} description={t('management:bulkDeployment.alerts.assistantDescription')} type="info" showIcon />
        <Tabs
          defaultActiveKey="devices"
          type="card"
          items={[
            {
              key: 'devices',
              label: (
                <span>
                  <DatabaseOutlined /> {t('management:bulkDeployment.tabs.devices')}
                </span>
              ),
              children: section(
                'devices',
                <Button type="primary" onClick={() => setDeviceImportOpen(true)}>
                  {t('management:bulkDeployment.actions.importDevices')}
                </Button>,
              ),
            },
            {
              key: 'panels',
              label: (
                <span>
                  <ApartmentOutlined /> {t('management:bulkDeployment.tabs.panels')}
                </span>
              ),
              children: section(
                'panels',
                <Button
                  type="primary"
                  onClick={() => {
                    form.resetFields();
                    setPreview(null);
                    setTemplateOpen(true);
                  }}
                >
                  {t('management:bulkDeployment.actions.createFromTemplate')}
                </Button>,
              ),
            },
            {
              key: 'cables',
              label: (
                <span>
                  <LinkOutlined /> {t('management:bulkDeployment.tabs.cables')}
                </span>
              ),
              children: section(
                'cables',
                <Button type="primary" onClick={() => setCableImportOpen(true)}>
                  {t('management:bulkDeployment.actions.importCables')}
                </Button>,
              ),
            },
          ]}
        />
        <Alert message={t('management:bulkDeployment.alerts.tipsTitle')} description={t('management:bulkDeployment.alerts.tipsDescription')} type="warning" showIcon />
      </Space>

      <Modal
        title={t('management:bulkDeployment.modals.createFromTemplate')}
        open={templateOpen}
        onOk={createFromTemplate}
        onCancel={() => setTemplateOpen(false)}
        width={900}
        forceRender
      >
        <Form name="bulk-deployment-page-form" form={form} layout="vertical">
          <Form.Item name="templateId" label={t('management:bulkDeployment.formLabels.selectTemplate')} rules={[{ required: true }]}>
            <Select
              placeholder={t('management:bulkDeployment.formPlaceholders.selectTemplate')}
              onChange={pickTemplate}
              options={templates.map((x) => ({ value: x.id, label: `${x.name} (${t(`panel:panelTypes.${x.type}`)}, ${x.portCount})` }))}
            />
          </Form.Item>
          <Form.Item name="deviceId" label={t('management:bulkDeployment.formLabels.selectDevice')} rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('management:bulkDeployment.formPlaceholders.selectDevice')}
              options={devices.map((d) => ({ value: d.id, label: `${d.name} (${t(`device:deviceTypes.${d.type}`)})` }))}
            />
          </Form.Item>
        </Form>
        {preview && <PanelView panel={{ name: preview.name, widthMm: preview.widthMm, heightMm: preview.heightMm }} ports={preview.ports ?? []} showLegend={false} scale={1.5} />}
      </Modal>

      <BulkImportModal
        open={deviceImportOpen}
        title={t('management:bulkDeployment.modals.importDevices')}
        columns={deviceColumns}
        templateRows={deviceTemplateRows}
        onCancel={() => setDeviceImportOpen(false)}
        onSubmit={importDevices}
      />
      <BulkImportModal
        open={cableImportOpen}
        title={t('management:bulkDeployment.modals.importCables')}
        columns={cableColumns}
        templateRows={cableTemplateRows}
        onCancel={() => setCableImportOpen(false)}
        onSubmit={importCables}
      />
    </div>
  );
}
