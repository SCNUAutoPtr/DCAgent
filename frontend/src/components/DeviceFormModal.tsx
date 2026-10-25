import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, Input, InputNumber, Modal, Radio, Select, Space, message } from 'antd';
import type { DeviceDto, DeviceModelDto } from '@contracts/devices';
import { DEVICE_TYPES, type DeviceType } from '@contracts/enums';
import type { CabinetDto, RoomDto } from '@contracts/hierarchy';
import { deviceModelService, deviceService } from '@/services/deviceService';
import { cabinetService, roomService } from '@/services/hierarchyService';
import { panelTemplateService } from '@/services/panelTemplateService';
import { TemplateSuggestions } from './panelTemplate/TemplateSuggestions';

type Placement = 'CABINET' | 'ROOM';

interface FormValues {
  name: string;
  type: DeviceType;
  deviceModelId?: string | null;
  serialNo?: string | null;
  sysname?: string | null;
  placement: Placement;
  cabinetId?: string;
  roomId?: string;
  uPosition?: number | null;
  uHeight?: number | null;
  notes?: string | null;
  /** create only: panels to generate from the model's templates */
  templateIds?: string[];
}

interface DeviceFormModalProps {
  open: boolean;
  /** edit this device; omitted: create */
  device?: DeviceDto | null;
  /** preselected cabinet for a new device */
  defaultCabinetId?: string;
  onClose: (changed: boolean) => void;
}

/** Create or edit a device, including where it sits (a cabinet U range, or directly in a room). */
export function DeviceFormModal({ open, device, defaultCabinetId, onClose }: DeviceFormModalProps) {
  const { t } = useTranslation(['device', 'common']);
  const [form] = Form.useForm<FormValues>();
  const [cabinets, setCabinets] = useState<CabinetDto[]>([]);
  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [models, setModels] = useState<DeviceModelDto[]>([]);
  const [saving, setSaving] = useState(false);
  const placement: Placement = Form.useWatch('placement', form) ?? 'CABINET';
  const deviceModelId = Form.useWatch('deviceModelId', form);

  useEffect(() => {
    if (!open) return;
    Promise.all([cabinetService.list(), roomService.list(), deviceModelService.list()]).then(
      ([c, r, m]) => {
        setCabinets(c);
        setRooms(r);
        setModels(m);
      },
      () => undefined,
    );
    form.resetFields();
    form.setFieldsValue({
      name: device?.name ?? '',
      type: device?.type,
      deviceModelId: device?.deviceModelId ?? undefined,
      serialNo: device?.serialNo ?? '',
      sysname: device?.sysname ?? '',
      placement: device && !device.cabinetId ? 'ROOM' : 'CABINET',
      cabinetId: device?.cabinetId ?? defaultCabinetId,
      roomId: device?.roomId ?? undefined,
      uPosition: device?.uPosition ?? null,
      // an existing device of unknown height stays empty (unknown) instead of turning into 1U
      uHeight: device ? device.uHeight : 1,
      notes: device?.notes ?? '',
    });
  }, [open, device, defaultCabinetId, form]);

  const cabinetOptions = useMemo(() => {
    const dcOf = new Map(rooms.map((r) => [r.id, r.dataCenterName]));
    return cabinets.map((c) => ({ value: c.id, label: `${dcOf.get(c.roomId) ?? ''} - ${c.roomName} - ${c.name}` }));
  }, [cabinets, rooms]);

  const save = async () => {
    const v = await form.validateFields();
    const place =
      v.placement === 'CABINET' ? { cabinetId: v.cabinetId ?? null, roomId: null, uPosition: v.uPosition ?? null } : { cabinetId: null, roomId: v.roomId ?? null, uPosition: null };
    const fields = { name: v.name, type: v.type, deviceModelId: v.deviceModelId ?? null, serialNo: v.serialNo, sysname: v.sysname, notes: v.notes };
    setSaving(true);
    try {
      if (device) {
        const moved = place.cabinetId !== device.cabinetId || place.roomId !== device.roomId;
        if (moved) await deviceService.move({ id: device.id, ...place });
        await deviceService.update({ id: device.id, ...fields, uHeight: v.uHeight ?? null, ...(moved ? {} : { uPosition: place.uPosition }) });
        message.success(t('device:messages.updateSuccess'));
      } else {
        const created = await deviceService.create({ ...fields, ...place, uHeight: v.uHeight ?? null });
        if (v.templateIds?.length) await panelTemplateService.createPanels({ deviceId: created.id, templateIds: v.templateIds });
        message.success(t('device:messages.createSuccess'));
      }
      onClose(true);
    } catch {
      // reported by rpc
    } finally {
      setSaving(false);
    }
  };

  const typeOptions = DEVICE_TYPES.map((type) => ({ value: type, label: t(`device:deviceTypes.${type}`) }));

  return (
    <Modal
      title={device ? t('device:editTitle') : t('device:createTitle')}
      open={open}
      onOk={save}
      confirmLoading={saving}
      onCancel={() => onClose(false)}
      okText={t('device:buttons.save')}
      cancelText={t('device:buttons.cancel')}
      width={640}
      forceRender
      wrapProps={{ 'data-testid': 'device-modal' }}
    >
      <Form name="device-form-modal-form" form={form} layout="vertical" data-testid="device-form">
        <Form.Item name="name" label={t('device:fields.name')} rules={[{ required: true, message: t('device:validation.nameRequired') }]}>
          <Input placeholder={t('device:placeholders.name')} data-testid="device-name-input" />
        </Form.Item>
        <Form.Item name="type" label={t('device:fields.type')} rules={[{ required: true, message: t('device:validation.typeRequired') }]}>
          <Select placeholder={t('device:placeholders.type')} data-testid="device-type-select" options={typeOptions} />
        </Form.Item>
        <Form.Item name="deviceModelId" label={t('device:fields.model')}>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={t('device:placeholders.model')}
            options={models.map((m) => ({ value: m.id, label: `${m.vendor} ${m.name}`.trim() }))}
          />
        </Form.Item>
        {!device && (
          <Form.Item name="templateIds" noStyle>
            <TemplateSuggestions deviceModelId={deviceModelId} />
          </Form.Item>
        )}
        <Space style={{ width: '100%' }} align="start">
          <Form.Item name="sysname" label={t('device:fields.sysname')} style={{ width: 280 }}>
            <Input placeholder={t('device:placeholders.sysname')} data-testid="device-sysname-input" />
          </Form.Item>
          <Form.Item name="serialNo" label={t('device:fields.serialNo')} style={{ width: 280 }}>
            <Input placeholder={t('device:placeholders.serialNo')} data-testid="device-serialno-input" />
          </Form.Item>
        </Space>
        <Form.Item name="placement" label={t('device:fields.placement')}>
          <Radio.Group>
            <Radio.Button value="CABINET">{t('device:placement.CABINET')}</Radio.Button>
            <Radio.Button value="ROOM">{t('device:placement.ROOM')}</Radio.Button>
          </Radio.Group>
        </Form.Item>
        {placement === 'CABINET' ? (
          <>
            <Form.Item name="cabinetId" label={t('device:fields.cabinet')} rules={[{ required: true, message: t('device:validation.cabinetRequired') }]}>
              <Select placeholder={t('device:placeholders.cabinet')} showSearch optionFilterProp="label" data-testid="device-cabinet-select" options={cabinetOptions} />
            </Form.Item>
            <Space style={{ width: '100%' }}>
              <Form.Item name="uPosition" label={t('device:fields.uPosition')}>
                <InputNumber min={1} max={60} style={{ width: 120 }} data-testid="device-uposition-input" />
              </Form.Item>
              <Form.Item name="uHeight" label={t('device:fields.uHeight')}>
                <InputNumber min={1} max={60} style={{ width: 120 }} placeholder={t('device:fields.uHeightUnknown')} data-testid="device-uheight-input" />
              </Form.Item>
            </Space>
          </>
        ) : (
          <Form.Item name="roomId" label={t('device:fields.room')} rules={[{ required: true, message: t('device:validation.roomRequired') }]}>
            <Select
              placeholder={t('device:placeholders.room')}
              showSearch
              optionFilterProp="label"
              options={rooms.map((r) => ({ value: r.id, label: `${r.dataCenterName} - ${r.name}` }))}
            />
          </Form.Item>
        )}
        <Form.Item name="notes" label={t('device:fields.notes')}>
          <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
