import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import type { SearchHit, SearchKind, globalSearchSchema } from '../contracts/search';
import { ipv4ToInt } from '../contracts/ip';
import { labelService } from './labelService';
import {
  cabinetPath,
  devicePath,
  deviceLocInclude,
  labelRef,
  labelSelect,
  panelLocInclude,
  panelPath,
  portLocInclude,
  portPath,
  roomLoc,
  roomPath,
} from './shared';

/** One query per kind, in parallel, each limited to `take`. Pure digits also resolve a label. */
async function global(db: Db, input: z.infer<typeof globalSearchSchema>): Promise<SearchHit[]> {
  const q = input.q;
  const s = { contains: q, mode: 'insensitive' as const };
  const take = input.take;
  const want = (k: SearchKind) => !input.kinds || input.kinds.includes(k);
  const none = Promise.resolve([] as SearchHit[]);

  const tasks: Promise<SearchHit[]>[] = [
    want('ROOM')
      ? db.room.findMany({ where: { OR: [{ name: s }, { floor: s }, { notes: s }] }, include: { ...roomLoc.include, label: labelSelect }, take }).then((rows) =>
          rows.map((r) => ({ kind: 'ROOM' as const, id: r.id, name: r.name, description: r.floor, label: labelRef(r.label), path: roomPath(r) })),
        )
      : none,
    want('CABINET')
      ? db.cabinet
          .findMany({ where: { OR: [{ name: s }, { positionCode: s }, { notes: s }] }, include: { room: roomLoc, label: labelSelect }, take })
          .then((rows) => rows.map((c) => ({ kind: 'CABINET' as const, id: c.id, name: c.name, description: c.positionCode, label: labelRef(c.label), path: cabinetPath(c) })))
      : none,
    want('DEVICE')
      ? db.device
          .findMany({
            where: { OR: [{ name: s }, { sysname: s }, { serialNo: s }, { notes: s }, { deviceModel: { name: s } }] },
            include: { ...deviceLocInclude, deviceModel: { select: { name: true } } },
            take,
          })
          .then((rows) =>
            rows.map((d) => ({ kind: 'DEVICE' as const, id: d.id, name: d.name, description: d.sysname ?? d.deviceModel?.name ?? null, label: null, path: devicePath(d) })),
          )
      : none,
    want('PANEL')
      ? db.panel
          .findMany({ where: { OR: [{ name: s }, { notes: s }] }, include: { ...panelLocInclude, label: labelSelect }, take })
          .then((rows) => rows.map((p) => ({ kind: 'PANEL' as const, id: p.id, name: `${p.device.name} ${p.name}`, description: p.type, label: labelRef(p.label), path: panelPath(p) })))
      : none,
    want('PORT')
      ? db.port
          .findMany({ where: { OR: [{ number: s }, { ifName: s }, { label: s }, { notes: s }] }, include: portLocInclude, take })
          .then((rows) => rows.map((p) => ({ kind: 'PORT' as const, id: p.id, name: `${p.panel.device.name} ${p.number}`, description: p.ifName, label: null, path: portPath(p) })))
      : none,
    want('CABLE')
      ? db.cable
          .findMany({ where: { OR: [{ label: s }, { notes: s }, { color: s }] }, take })
          .then((rows) => rows.map((c) => ({ kind: 'CABLE' as const, id: c.id, name: c.label ?? c.id, description: c.medium, label: null, path: [{ kind: 'CABLE' as const, id: c.id, name: c.label ?? 'cable' }] })))
      : none,
    want('WORKSTATION')
      ? db.workstation
          .findMany({ where: { OR: [{ name: s }, { code: s }, { assignedTo: s }] }, include: { room: roomLoc }, take })
          .then((rows) =>
            rows.map((w) => ({
              kind: 'WORKSTATION' as const,
              id: w.id,
              name: w.name,
              description: w.code,
              label: null,
              path: roomPath(w.room),
            })),
          )
      : none,
    want('IP_ADDRESS')
      ? db.ipAddress
          .findMany({
            where: { OR: [...(ipv4ToInt(q) !== null ? [{ address: q }] : []), { hostname: s }, { description: s }, { macAddress: s }] },
            include: { subnet: { select: { name: true } } },
            take,
          })
          .then((rows) => rows.map((a) => ({ kind: 'IP_ADDRESS' as const, id: a.id, name: a.address, description: a.subnet.name, label: null, path: [] })))
      : none,
  ];

  const hits = (await Promise.all(tasks)).flat();

  if (/^\d+$/.test(q) && Number(q) <= 2_147_483_647 && Number(q) > 0) {
    const r = await labelService.resolve(db, Number(q));
    if (r.bound) {
      const last = r.bound.path[r.bound.path.length - 1];
      const kind: SearchKind = r.bound.kind;
      if (!hits.some((h) => h.kind === kind && h.id === r.bound!.id)) {
        hits.unshift({ kind, id: r.bound.id, name: last?.name ?? q, description: r.display, label: { shortId: r.shortId, state: r.state! }, path: r.bound.path });
      }
    }
  }
  return hits;
}

export const searchService = { global };

