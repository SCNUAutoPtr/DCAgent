// Interface name helpers shared by backend and frontend. Pure, no dependencies.

const LONG_FORMS: [RegExp, string][] = [
  [/^(?:XGE|XGigabitEthernet)\s*/i, 'XGigabitEthernet'],
  [/^(?:GE|GigabitEthernet)\s*/i, 'GigabitEthernet'],
  [/^MEth\s*/i, 'MEth'],
  [/^(?:Eth-Trunk)\s*/i, 'Eth-Trunk'],
  [/^(?:40GE)\s*/i, '40GE'],
  [/^(?:100GE)\s*/i, '100GE'],
  [/^(?:25GE)\s*/i, '25GE'],
];

/** "GE0/0/1" -> "GigabitEthernet0/0/1", "XGE0/0/2" -> "XGigabitEthernet0/0/2"; other names are trimmed only. */
export function normalizeIfName(raw: string): string {
  const s = raw.trim();
  for (const [re, long] of LONG_FORMS) {
    if (re.test(s)) return long + s.replace(re, '');
  }
  return s;
}

/** "GigabitEthernet0/0/1" -> "GE0/0/1" (display only). */
export function shortIfName(name: string): string {
  return name.replace(/^XGigabitEthernet/, 'XGE').replace(/^GigabitEthernet/, 'GE');
}

/** Key used to compare sysnames loosely: "445A-U6", "445AU6" and "445a-u6" are the same switch. */
export function sysnameKey(name: string): string {
  return name.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

/** Trailing integer of a port number ("ge11" -> 11, "xge1/0/1" -> 1); null when there is none. */
export function trailingNumber(number: string): number | null {
  const m = /(\d+)\D*$/.exec(number);
  return m ? Number(m[1]) : null;
}
