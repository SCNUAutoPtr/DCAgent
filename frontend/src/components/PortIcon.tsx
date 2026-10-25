import type { PortType } from '@contracts/enums';
import { PORT_ICONS } from '@/constants/portIcons';

interface PortIconProps {
  portType: PortType;
  /** pixels */
  size?: number;
  className?: string;
}

/** SVG icon of a port type, for menus and legends. */
export function PortIcon({ portType, size = 24, className }: PortIconProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, display: 'inline-block' }}
      dangerouslySetInnerHTML={{ __html: PORT_ICONS[portType] }}
    />
  );
}
