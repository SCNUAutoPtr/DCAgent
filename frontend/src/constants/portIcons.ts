// SVG icon per port type, drawn in the cage's own millimetre box (see PORT_SIZE_MM).
import type { PortType } from '@contracts/enums';

export const PORT_ICONS: Record<PortType, string> = {
  RJ45: `
    <svg viewBox="0 0 16 14" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="14" height="12" rx="1" fill="#1890ff" stroke="#0050b3" stroke-width="0.5"/>
      <line x1="2.5" y1="3" x2="2.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="4" y1="3" x2="4" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="5.5" y1="3" x2="5.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="7" y1="3" x2="7" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="9" y1="3" x2="9" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="10.5" y1="3" x2="10.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="12" y1="3" x2="12" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="13.5" y1="3" x2="13.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <rect x="6" y="10" width="4" height="2" fill="#003a8c"/>
    </svg>
  `,
  SFP: `
    <svg viewBox="0 0 13.5 8.5" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="12.5" height="7.5" rx="0.5" fill="#52c41a" stroke="#389e0d" stroke-width="0.4"/>
      <rect x="2" y="2" width="2" height="4.5" rx="0.3" fill="#237804"/>
      <rect x="5" y="2" width="2" height="4.5" rx="0.3" fill="#237804"/>
      <circle cx="9.5" cy="3" r="0.8" fill="#fff" opacity="0.8"/>
      <circle cx="9.5" cy="5.5" r="0.8" fill="#fff" opacity="0.8"/>
    </svg>
  `,
  SFP_PLUS: `
    <svg viewBox="0 0 13.5 8.5" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="12.5" height="7.5" rx="0.5" fill="#13c2c2" stroke="#08979c" stroke-width="0.4"/>
      <rect x="2" y="2" width="2" height="4.5" rx="0.3" fill="#006d75"/>
      <rect x="5" y="2" width="2" height="4.5" rx="0.3" fill="#006d75"/>
      <line x1="9" y1="4.25" x2="11" y2="4.25" stroke="#fff" stroke-width="0.8"/>
      <line x1="10" y1="3.25" x2="10" y2="5.25" stroke="#fff" stroke-width="0.8"/>
    </svg>
  `,
  SFP28: `
    <svg viewBox="0 0 13.5 8.5" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="12.5" height="7.5" rx="0.5" fill="#2f54eb" stroke="#1d39c4" stroke-width="0.4"/>
      <rect x="2" y="2" width="2" height="4.5" rx="0.3" fill="#10239e"/>
      <rect x="5" y="2" width="2" height="4.5" rx="0.3" fill="#10239e"/>
      <line x1="9" y1="4.25" x2="11" y2="4.25" stroke="#fff" stroke-width="0.8"/>
      <line x1="10" y1="3.25" x2="10" y2="5.25" stroke="#fff" stroke-width="0.8"/>
    </svg>
  `,
  QSFP: `
    <svg viewBox="0 0 18.5 8.5" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="17.5" height="7.5" rx="0.5" fill="#722ed1" stroke="#531dab" stroke-width="0.4"/>
      <rect x="2" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <rect x="5.5" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <rect x="9" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <rect x="12.5" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <text x="15.5" y="6" font-size="3" fill="#fff" font-family="Arial" font-weight="bold">Q</text>
    </svg>
  `,
  QSFP28: `
    <svg viewBox="0 0 18.5 8.5" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="17.5" height="7.5" rx="0.5" fill="#722ed1" stroke="#531dab" stroke-width="0.4"/>
      <rect x="2" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <rect x="5.5" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <rect x="9" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <rect x="12.5" y="2" width="1.5" height="4.5" rx="0.2" fill="#391085"/>
      <text x="14.5" y="6" font-size="2.5" fill="#fff" font-family="Arial" font-weight="bold">28</text>
    </svg>
  `,
  QSFP_DD: `
    <svg viewBox="0 0 18.5 9.5" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="17.5" height="8.5" rx="0.5" fill="#eb2f96" stroke="#c41d7f" stroke-width="0.4"/>
      <rect x="2" y="1.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="5" y="1.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="8" y="1.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="11" y="1.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="2" y="5.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="5" y="5.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="8" y="5.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <rect x="11" y="5.5" width="1.2" height="3" rx="0.2" fill="#780650"/>
      <text x="14" y="6" font-size="2.5" fill="#fff" font-family="Arial" font-weight="bold">DD</text>
    </svg>
  `,
  CONSOLE: `
    <svg viewBox="0 0 16 14" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="14" height="12" rx="1" fill="#8c8c8c" stroke="#595959" stroke-width="0.5"/>
      <line x1="2.5" y1="3" x2="2.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="4" y1="3" x2="4" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="5.5" y1="3" x2="5.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="7" y1="3" x2="7" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="9" y1="3" x2="9" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="10.5" y1="3" x2="10.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="12" y1="3" x2="12" y2="7" stroke="#fff" stroke-width="0.5"/>
      <line x1="13.5" y1="3" x2="13.5" y2="7" stroke="#fff" stroke-width="0.5"/>
      <rect x="6" y="10" width="4" height="2" fill="#434343"/>
    </svg>
  `,
  USB: `
    <svg viewBox="0 0 14 7" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="13" height="6" rx="0.5" fill="#1890ff" stroke="#0050b3" stroke-width="0.4"/>
      <circle cx="7" cy="3.5" r="0.8" fill="#fff"/>
      <line x1="7" y1="3.5" x2="7" y2="1.5" stroke="#fff" stroke-width="0.6"/>
      <line x1="7" y1="1.5" x2="5.5" y2="2" stroke="#fff" stroke-width="0.5"/>
      <line x1="7" y1="1.5" x2="8.5" y2="2" stroke="#fff" stroke-width="0.5"/>
      <circle cx="5.5" cy="2" r="0.4" fill="#fff"/>
      <rect x="3" y="4.5" width="0.8" height="1.5" fill="#003a8c"/>
      <rect x="5.5" y="4.5" width="0.8" height="1.5" fill="#003a8c"/>
      <rect x="8" y="4.5" width="0.8" height="1.5" fill="#003a8c"/>
      <rect x="10.5" y="4.5" width="0.8" height="1.5" fill="#003a8c"/>
    </svg>
  `,
  POWER: `
    <svg viewBox="0 0 20 15" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="19" height="14" rx="1" fill="#f5222d" stroke="#cf1322" stroke-width="0.5"/>
      <rect x="4" y="4" width="2.5" height="7" rx="0.5" fill="#820014"/>
      <rect x="8.75" y="4" width="2.5" height="7" rx="0.5" fill="#820014"/>
      <rect x="13.5" y="4" width="2.5" height="7" rx="0.5" fill="#820014"/>
      <text x="2" y="13.5" font-size="2" fill="#fff" font-family="Arial" font-weight="bold">C13</text>
      <circle cx="17" cy="3" r="0.8" fill="#ffa39e"/>
      <line x1="17" y1="3.8" x2="17" y2="5" stroke="#ffa39e" stroke-width="0.5"/>
      <line x1="16" y1="5" x2="18" y2="5" stroke="#ffa39e" stroke-width="0.5"/>
      <line x1="16.3" y1="5.5" x2="17.7" y2="5.5" stroke="#ffa39e" stroke-width="0.4"/>
    </svg>
  `,
  OTHER: `
    <svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <rect x="0.5" y="0.5" width="11" height="11" rx="1" fill="#bfbfbf" stroke="#8c8c8c" stroke-width="0.4"/>
      <circle cx="6" cy="6" r="2" fill="#595959"/>
    </svg>
  `,
};
