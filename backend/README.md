# DCAgent backend

Express + Prisma + PostgreSQL. No graph database: every connection is a single hop and is read with one Prisma include.

## API

Every call is `POST /api/v1/<resource>/<action>` with a JSON body; there are no query strings, path parameters, GET, PUT or DELETE routes.
Errors are always `{ code, message, details }` (codes in `src/contracts/enums.ts`, `ERROR_CODES`).

Resources: `datacenters`, `rooms` (incl. `scene`), `cabinets`, `devices` (incl. `move`), `device-models`, `panels`, `ports`,
`cables` (`create` builds both ends, `connect-end`, `disconnect-end`), `labels` (shortID: `resolve`, `rebind`, `void`, `missing`, `print-tasks/*`),
`optical-modules`, `subnets`, `ip-addresses`, `workstations`, `observability`, `panel-templates`, `search`, `dashboard`.

Request schemas and response DTOs live in `src/contracts/` and are shared with the frontend (`@contracts`; type imports,
plus values from the dependency-free files such as `enums.ts`, `ifName.ts`, `rack.ts`). The full route list is in `docs/API.md`.
The old OpenAPI/Apifox files described the pre-refactor API and were removed.

## Layout

```
src/config/env.ts      validated environment (first import of every entry point)
src/contracts/         zod schemas, DTO types, dependency-free enums, pure helpers (ifName, shortId, subnet math, port generator)
src/http/              rpc router (read / write-in-one-transaction) and the single error middleware
src/services/          use cases; each takes a transaction client and throws AppError only
src/routes/            parse body, call service, return DTO
prisma/migrations/     0001_baseline: generated DDL + hand-written native constraints at the end
```

Rules enforced by the database (see the end of `0001_baseline/migration.sql`): one label per entity and one entity per label;
cabinets, panels and cable ends must carry a label (checked at commit); no overlapping U ranges; one cable end per port;
an IP address lies inside its subnet and has at most one owner; deleting a device never cascades its port observation
history (RESTRICT, the service deletes it only on force). Device.uHeight NULL means "height not known" and occupies the
U it sits in. Name columns use the ICU collation `natural` ("S110-9" < "S110-10"). Derived state (port connected, cable
stock/in use, workstation online) is computed on read and never stored.

## Databases

| database | use |
|---|---|
| `dcagent` | real data (`.env`); only `npm run db:deploy` and `npm run migrate:legacy -- --target=prod --apply` touch it |
| `dcagent_test` | tests and rehearsals (`.env.test`, name must end with `_test`) |
| `dcagent_legacy` | the pre-refactor dump restored read-only by `npm run db:legacy:restore` |

## Scripts

```
npm run dev               nodemon + tsx on PORT from .env
npm run build             tsc to dist/
npm run typecheck         src + scripts + test, plus the emoji check
npm test                  unit tests, then integration tests on dcagent_test (reset first)
npm run db:deploy         prisma migrate deploy
npm run db:test:reset     rebuild dcagent_test (refuses any other database)
npm run db:legacy:restore restore the baseline dump into dcagent_legacy
npm run migrate:legacy -- --target=test|prod [--apply] [--overwrite-live]
npm run templates:presets import template-kit/examples (idempotent)
```

`migrate:legacy` rebuilds the target from `dcagent_legacy` in one transaction, reconciles table by table (counts, ids,
relations, labels, derived state, per-row md5) and only commits when everything is green. Reports and the label reprint
list go to `migration-reports/` (git-ignored). The read-only Neo4j backup in `db-backups/` is cross-checked as item g:
every node and connection must be in legacy PG or be an orphan whose parent is gone there.

`--target=prod --apply` refuses to run when the real database is neither empty nor exactly what the last committed prod
migration wrote (per-table digest), because the rebuild truncates every business table. `--overwrite-live` skips that
check; take a `pg_dump` first.
