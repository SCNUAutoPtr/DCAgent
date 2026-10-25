import assert from 'node:assert/strict';
import test from 'node:test';
import { compareNeo4jExport, parseNeo4jExport } from './neo4jExport';

// shape of the APOC export: a one-column CSV with \" escaped quotes
const EXPORT = String.raw`cypherStatements
"UNWIND [{_id:0, properties:{name:\"front\", id:\"p1\", deviceId:\"d1\"}}, {_id:1, properties:{name:\"E2E-A\", id:\"p9\", deviceId:\"gone\"}}] AS row
CREATE (n:` + '`UNIQUE IMPORT LABEL`' + String.raw`{` + '`UNIQUE IMPORT ID`' + String.raw`: row._id}) SET n += row.properties SET n:Panel;
UNWIND [{_id:2, properties:{label:\"real\", id:\"c1\", type:\"CAT6\"}}, {_id:3, properties:{label:\"E2E Dual\", id:\"c9\"}}] AS row
CREATE (n:x{y: row._id}) SET n += row.properties SET n:Cable;
UNWIND [{_id:4, properties:{number:\"1\", panelId:\"p1\", id:\"a\"}}, {_id:5, properties:{number:\"2\", panelId:\"p1\", id:\"b\"}}, {_id:6, properties:{number:\"1\", panelId:\"p9\", id:\"z1\"}}, {_id:7, properties:{number:\"2\", panelId:\"p9\", id:\"z2\"}}] AS row
CREATE (n:x{y: row._id}) SET n += row.properties SET n:Port;
UNWIND [{start: {_id:4}, end: {_id:2}, properties:{}}, {start: {_id:2}, end: {_id:5}, properties:{}}, {start: {_id:6}, end: {_id:3}, properties:{}}, {start: {_id:3}, end: {_id:7}, properties:{}}] AS row
MATCH (start:x{y: row.start._id})
MATCH (end:x{y: row.end._id})
CREATE (start)-[r:CONNECTED_BY]->(end) SET r += row.properties;"
`;

const pg = () => ({
  devices: new Set(['d1']),
  panels: new Set(['p1']),
  ports: new Set(['a', 'b']),
  cables: new Set(['c1']),
  triples: new Set(['c1|a|b']),
});

test('parses nodes with labels and relationships from the export', () => {
  const e = parseNeo4jExport(EXPORT);
  assert.equal(e.nodes.length, 8);
  assert.deepEqual(e.nodes[0], { exportId: 0, label: 'Panel', props: { name: 'front', id: 'p1', deviceId: 'd1' } });
  assert.equal(e.rels.filter((r) => r.type === 'CONNECTED_BY').length, 4);
});

test('nodes whose parents are gone in PG are classified as orphans, the rest must be in PG', () => {
  const r = compareNeo4jExport(parseNeo4jExport(EXPORT), pg());
  assert.equal(r.ok, true);
  assert.equal(r.orphans.panels, 1);
  assert.equal(r.orphans.ports, 2);
  assert.deepEqual(r.orphans.cables, [{ id: 'c9', name: 'E2E Dual' }]);
  assert.equal(r.missingTriplesExplainedByOrphans, 1);
});

test('a node missing from PG with its parent still there is unexplained', () => {
  const p = pg();
  p.ports.delete('b');
  p.triples.clear();
  const r = compareNeo4jExport(parseNeo4jExport(EXPORT), p);
  assert.equal(r.ok, false);
  assert.deepEqual(r.unexplainedNodes.map((n) => n.id), ['b']);
  assert.equal(r.unexplainedTriples.length, 1);
});
