#!/usr/bin/env bash
# Restore the read-only baseline dump into dcagent_legacy (drop + create every run).
# The dump is fed through stdin; the file itself is never modified.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DUMP="${LEGACY_DUMP:-$ROOT/db-backups/dcagent-before-night-modernize-20261025-0057.dump}"
CONTAINER="${PG_CONTAINER:-dcagent-postgres}"
PGUSER_NAME="${PG_USER:-dcagent}"
DB=dcagent_legacy

[ -r "$DUMP" ] || { echo "[error] dump not readable: $DUMP" >&2; exit 1; }

docker exec "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PGUSER_NAME" -d postgres \
  -c "DROP DATABASE IF EXISTS $DB WITH (FORCE)" -c "CREATE DATABASE $DB"
docker exec -i "$CONTAINER" pg_restore -U "$PGUSER_NAME" -d "$DB" --no-owner --no-privileges < "$DUMP"

docker exec "$CONTAINER" psql -U "$PGUSER_NAME" -d "$DB" -At -F ' ' -c "
SELECT 'DataCenter', count(*) FROM \"DataCenter\" UNION ALL
SELECT 'Room', count(*) FROM \"Room\" UNION ALL
SELECT 'Cabinet', count(*) FROM \"Cabinet\" UNION ALL
SELECT 'Device', count(*) FROM \"Device\" UNION ALL
SELECT 'Panel', count(*) FROM \"Panel\" UNION ALL
SELECT 'Port', count(*) FROM \"Port\" UNION ALL
SELECT 'Cable', count(*) FROM \"Cable\" UNION ALL
SELECT 'CableEndpoint', count(*) FROM \"CableEndpoint\" UNION ALL
SELECT 'Workstation', count(*) FROM \"Workstation\" UNION ALL
SELECT 'PanelTemplate', count(*) FROM \"PanelTemplate\" UNION ALL
SELECT 'ShortIdPool', count(*) FROM \"ShortIdPool\" UNION ALL
SELECT 'CableShortIdPool', count(*) FROM \"CableShortIdPool\" UNION ALL
SELECT 'IpSubnet', count(*) FROM \"IpSubnet\" UNION ALL
SELECT 'IpAddress', count(*) FROM \"IpAddress\" UNION ALL
SELECT 'PortObservation', count(*) FROM \"PortObservation\" UNION ALL
SELECT 'PrintTask', count(*) FROM \"PrintTask\" UNION ALL
SELECT 'OpticalModule', count(*) FROM \"OpticalModule\" UNION ALL
SELECT 'ModuleMovement', count(*) FROM \"ModuleMovement\""
