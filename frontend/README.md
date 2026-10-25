# DCAgent Frontend

React 18 + TypeScript + Vite + Ant Design 5 + React Router 6 + React Flow + i18next (zh-CN / en-US / ja-JP).

## Contracts and API

- Types come from the backend: `@contracts/*` maps to `../backend/src/contracts/*`. Pages use `import type` for DTOs and
  request schemas; only dependency-free files (`enums`, `shortId`, `ipv4`, `portSizes`, `scene`, `ifName`, `moduleFits`)
  are imported as values, so zod never ends up in the bundle.
- Every request goes through `services/api.ts`: `rpc<Req, Res>(path, body)` posts to the same origin `/api/v1/<resource>/<action>`
  with all parameters in the JSON body. A failure `{code, message, details}` is shown as the translated `errors:<code>` text and
  rethrown as `ApiError` (pass `{ silent: true }` to handle it yourself).
- One named service per resource (`hierarchyService.ts` exports `dataCenterService`, `roomService`, `cabinetService`, ...).

## Routes

All routes, the menu (longest-prefix highlight) and the path builders live in `src/routes.tsx`. Shareable locations are path
segments only: `/rooms/:id` (floor plan), `/cabinets/:id` (rack view), `/topology/panel/:id`, `/ports/:id`, `/cables/:id`,
`/optical-modules/:id`, `/ip-management/subnet/:id`. Search and label scans go through `pathForEntity`.

## Development

```bash
npm install
cp .env.example .env   # API_PROXY_TARGET, read by the Vite dev server only
npm run dev            # http://localhost:5173, proxies /api to API_PROXY_TARGET (default http://127.0.0.1:3000)
```

| Script | What it checks |
|---|---|
| `npm run build` | `tsc && vite build`; i18n keys are typed against zh-CN (`src/i18next.d.ts`) |
| `npm run lint` | ESLint, no `any`, no CJK literals outside `eslint-cjk-allowlist.json` (the list may only shrink) |
| `npm test` | locale parity across the three languages, error-code coverage of `errors.json`, allowlist hygiene, no emoji |
| `npm run e2e` | Playwright (Chrome) against its own stack, see below |

## E2E

`playwright.config.ts` starts a separate stack: the backend on 3100 with `NODE_ENV=test` after `npm run db:test:reset`
(which refuses any database not ending in `_test`), and Vite on 5174 proxying to it. `e2e/global-setup.ts` aborts when that
backend already holds devices. Specs create their own data through the RPC API with unique names, and every spec fails on a
console error or warning. The real database (`dcagent`, served on 3000/5173) is never touched.

## i18n

Resources are picked up from `src/locales/<lang>/<ns>.json` by `import.meta.glob`. Add a key to all three languages; zh-CN
is the reference for the compile-time key check. Error codes are translated in the `errors` namespace.
