# Locales

`src/i18n.ts` loads every `<lang>/<ns>.json` automatically (`import.meta.glob`). zh-CN defines the namespaces and is the
reference for typed keys (`src/i18next.d.ts`); `npm test` checks that en-US and ja-JP have exactly the same keys.

- New text: add the key to all three languages and use `t('<ns>:<key>')`.
- Enum values are translated under keys named after the value, e.g. `cable:media.FIBER_SM`, `panel:portTypes.SFP_PLUS`.
- Backend error codes live in `errors.json` (`errors:<CODE>`); `npm test` fails when a code from `contracts/enums.ts` is missing.
- A new language: register it in `languages.ts` and add the folder with every namespace.
