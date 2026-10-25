// Safety net before any spec runs: the backend under test must be the freshly reset test stack.
// A database that already holds devices is not the one db:test:reset just rebuilt, so stop.
const BACKEND = 'http://127.0.0.1:3100';

export default async function globalSetup() {
  const res = await fetch(`${BACKEND}/api/v1/dashboard/overview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  if (!res.ok) throw new Error(`test backend not reachable: ${res.status}`);
  const overview = (await res.json()) as { counts: { devices: number; cabinets: number } };
  if (overview.counts.devices !== 0 || overview.counts.cabinets !== 0) {
    throw new Error('refusing to run E2E: the backend on 3100 is not serving a freshly reset dcagent_test');
  }
}
