import { useEffect, useMemo, useState } from 'react';
import { Select, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import type { DeviceDto } from '@contracts/devices';
import type { PanelDto, PortDto } from '@contracts/panels';
import { deviceService } from '@/services/deviceService';
import { panelService } from '@/services/panelService';

interface PortPickerProps {
  value?: string;
  onChange?: (portId: string | undefined, port?: PortDto) => void;
  /** ports failing this are shown disabled */
  selectable?: (port: PortDto) => boolean;
  testIdPrefix?: string;
}

/** Device -> panel -> port cascade. One request per chosen device (panels come with their ports). */
export function PortPicker({ value, onChange, selectable, testIdPrefix = 'port-picker' }: PortPickerProps) {
  const { t } = useTranslation('common');
  const [devices, setDevices] = useState<DeviceDto[]>([]);
  const [deviceId, setDeviceId] = useState<string>();
  const [panels, setPanels] = useState<PanelDto[]>([]);
  const [panelId, setPanelId] = useState<string>();

  useEffect(() => {
    deviceService.list().then(setDevices, () => undefined);
  }, []);

  useEffect(() => {
    setPanels([]);
    if (deviceId) panelService.list({ deviceId, includePorts: true }).then(setPanels, () => undefined);
  }, [deviceId]);

  const ports = useMemo(() => panels.find((p) => p.id === panelId)?.ports ?? [], [panels, panelId]);

  return (
    <Space wrap>
      <Select
        showSearch
        optionFilterProp="label"
        placeholder={t('portPicker.selectDevice')}
        style={{ width: 220 }}
        value={deviceId}
        data-testid={`${testIdPrefix}-device`}
        options={devices.map((d) => ({ value: d.id, label: d.name }))}
        onChange={(v: string) => {
          setDeviceId(v);
          setPanelId(undefined);
          onChange?.(undefined);
        }}
      />
      <Select
        placeholder={t('portPicker.selectPanel')}
        style={{ width: 180 }}
        value={panelId}
        disabled={!deviceId}
        data-testid={`${testIdPrefix}-panel`}
        options={panels.map((p) => ({ value: p.id, label: p.name }))}
        onChange={(v: string) => {
          setPanelId(v);
          onChange?.(undefined);
        }}
      />
      <Select
        showSearch
        optionFilterProp="label"
        placeholder={t('portPicker.selectPort')}
        style={{ width: 200 }}
        value={value}
        disabled={!panelId}
        data-testid={`${testIdPrefix}-port`}
        options={ports.map((p) => {
          const ok = selectable ? selectable(p) : true;
          return { value: p.id, label: `${p.number}${p.ifName ? ` (${p.ifName})` : ''}${ok ? '' : ` - ${t('portPicker.busy')}`}`, disabled: !ok };
        })}
        onChange={(v: string) => onChange?.(v, ports.find((p) => p.id === v))}
      />
    </Space>
  );
}
