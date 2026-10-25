// Guards for destructive scripts. Every script that drops, truncates or resets calls one of these first.

export function dbName(url: string): string {
  const u = new URL(url);
  return decodeURIComponent(u.pathname.replace(/^\//, ''));
}

/** Throws unless the database name ends with _test. */
export function assertTestDb(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is not set');
  const name = dbName(url);
  if (!name.endsWith('_test')) throw new Error(`refusing to touch database "${name}": name must end with _test`);
  return name;
}

/** Throws when the url points at the legacy (read-only source) database. */
export function assertNotLegacy(url: string | undefined): string {
  if (!url) throw new Error('DATABASE_URL is not set');
  const name = dbName(url);
  if (name === 'dcagent_legacy' || name.endsWith('_legacy')) throw new Error(`refusing to write to legacy database "${name}"`);
  return name;
}

export function withDb(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}
