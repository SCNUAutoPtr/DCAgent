// Reader for the APOC cypher export in db-backups/ (neo4j-before-night-modernize-*.cypher).
// Pure functions: the migration uses them to cross-check the read-only Neo4j backup against legacy Postgres.

export interface ExportNode {
  exportId: number;
  label: string;
  props: Record<string, string>;
}

export interface ExportRel {
  type: string;
  start: number;
  end: number;
}

export interface Neo4jExport {
  nodes: ExportNode[];
  rels: ExportRel[];
}

function parseProps(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+):("(?:[^"\\]|\\.)*"|[^,}]+)/g;
  for (let m = re.exec(body); m; m = re.exec(body)) {
    const raw = m[2].trim();
    out[m[1]] = raw.startsWith('"') ? (JSON.parse(raw) as string) : raw;
  }
  return out;
}

export function parseNeo4jExport(text: string): Neo4jExport {
  // the export is a one-column CSV: statements are quoted and inner quotes escaped as \"
  const src = text.replace(/\\"/g, '"');
  const nodes: ExportNode[] = [];
  const rels: ExportRel[] = [];
  const stmt = /UNWIND \[([\s\S]*?)\] AS row\s+(?:CREATE \(n:[^;]*?SET n:(\w+);|MATCH[\s\S]*?CREATE \(start\)-\[r:(\w+)\])/g;
  for (let m = stmt.exec(src); m; m = stmt.exec(src)) {
    const [, rows, label, relType] = m;
    if (label) {
      const node = /\{_id:(\d+), properties:\{(.*?)\}\}/g;
      for (let n = node.exec(rows); n; n = node.exec(rows)) nodes.push({ exportId: Number(n[1]), label, props: parseProps(n[2]) });
    } else {
      const rel = /\{start: \{_id:(\d+)\}, end: \{_id:(\d+)\}/g;
      for (let r = rel.exec(rows); r; r = rel.exec(rows)) rels.push({ type: relType, start: Number(r[1]), end: Number(r[2]) });
    }
  }
  return { nodes, rels };
}

export interface LegacyIds {
  devices: Set<string>;
  panels: Set<string>;
  ports: Set<string>;
  cables: Set<string>;
  /** "cableId|portA|portB" with the two port ids sorted */
  triples: Set<string>;
}

/**
 * Every Neo4j node and connection must exist in legacy Postgres, or be an orphan whose parent is gone
 * there (left behind by deletes that never reached Neo4j). Anything else is unexplained and fails.
 */
export function compareNeo4jExport(exp: Neo4jExport, pg: LegacyIds) {
  const byExportId = new Map(exp.nodes.map((n) => [n.exportId, n]));
  const inPg = (n: ExportNode) =>
    n.label === 'Panel' ? pg.panels.has(n.props.id) : n.label === 'Port' ? pg.ports.has(n.props.id) : n.label === 'Cable' ? pg.cables.has(n.props.id) : pg.devices.has(n.props.id);
  const orphanPanels = new Set(exp.nodes.filter((n) => n.label === 'Panel' && !inPg(n) && !pg.devices.has(n.props.deviceId)).map((n) => n.props.id));
  const orphanPorts = new Set(
    exp.nodes.filter((n) => n.label === 'Port' && !inPg(n) && (!pg.panels.has(n.props.panelId) || orphanPanels.has(n.props.panelId))).map((n) => n.props.id),
  );
  // a cable is orphaned when every port it is connected to in Neo4j is an orphan
  const cablePorts = new Map<string, string[]>();
  for (const r of exp.rels.filter((x) => x.type === 'CONNECTED_BY')) {
    const a = byExportId.get(r.start);
    const b = byExportId.get(r.end);
    const cable = a?.label === 'Cable' ? a : b?.label === 'Cable' ? b : null;
    const port = a?.label === 'Port' ? a : b?.label === 'Port' ? b : null;
    if (cable && port) cablePorts.set(cable.props.id, [...(cablePorts.get(cable.props.id) ?? []), port.props.id]);
  }
  const orphanCables = new Set(
    exp.nodes
      .filter((n) => n.label === 'Cable' && !inPg(n))
      .filter((n) => (cablePorts.get(n.props.id) ?? []).every((p) => orphanPorts.has(p)))
      .map((n) => n.props.id),
  );
  const isOrphan = (n: ExportNode) => orphanPanels.has(n.props.id) || orphanPorts.has(n.props.id) || orphanCables.has(n.props.id);

  const counts: Record<string, { total: number; inPg: number; orphan: number }> = {};
  const unexplainedNodes: { label: string; id: string; name: string | null }[] = [];
  for (const n of exp.nodes) {
    const c = (counts[n.label] ??= { total: 0, inPg: 0, orphan: 0 });
    c.total++;
    if (inPg(n)) c.inPg++;
    else if (isOrphan(n)) c.orphan++;
    else unexplainedNodes.push({ label: n.label, id: n.props.id, name: n.props.name ?? n.props.label ?? n.props.number ?? null });
  }
  const triples: string[] = [];
  for (const [cableId, ports] of cablePorts) if (ports.length === 2) triples.push(`${cableId}|${[...ports].sort().join('|')}`);
  const missingTriples = triples.filter((t) => !pg.triples.has(t));
  const unexplainedTriples = missingTriples.filter((t) => !orphanCables.has(t.split('|')[0]));
  return {
    counts,
    orphans: {
      panels: orphanPanels.size,
      ports: orphanPorts.size,
      cables: [...orphanCables].map((id) => ({ id, name: exp.nodes.find((n) => n.props.id === id)?.props.label ?? null })),
    },
    connectedTriples: triples.length,
    missingTriplesExplainedByOrphans: missingTriples.length - unexplainedTriples.length,
    unexplainedNodes,
    unexplainedTriples,
    ok: unexplainedNodes.length === 0 && unexplainedTriples.length === 0,
  };
}
