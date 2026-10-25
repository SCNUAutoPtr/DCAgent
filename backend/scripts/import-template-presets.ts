// Imports template-kit/examples as system panel templates into the database of DATABASE_URL.
// Idempotent: unchanged templates are left alone, changed ones get a new revision.
import { inTx } from '../src/http/rpc';
import { prisma } from '../src/utils/prisma';
import { panelTemplateService } from '../src/services/panelTemplateService';

async function main() {
  const r = await inTx((tx) => panelTemplateService.importPresets(tx));
  console.log(`[ok] presets: created ${r.created.length}, updated ${r.updated.length}, unchanged ${r.unchanged.length}`);
}

main()
  .catch((e) => {
    console.error('[error]', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
