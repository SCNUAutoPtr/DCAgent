// Must be the first import of every entry point. Loads .env (or .env.test when NODE_ENV=test)
// and validates it; a missing key stops the process. No default credentials.
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

const root = path.resolve(__dirname, '..', '..');
const file = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
// In test mode .env.test always wins, even over variables Prisma may already have loaded from .env,
// so a test can never reach the real database.
dotenv.config({ path: path.join(root, file), override: process.env.NODE_ENV === 'test' });

const schema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().min(1).max(65535),
  HOST: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']),
  CORS_ORIGIN: z.string().min(1),
  ONLINE_STALE_MINUTES: z.coerce.number().int().min(1),
  OBS_DEFAULT_SAMPLING_RATES: z.string().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
  console.error(`[error] invalid environment (${file}): ${keys}`);
  process.exit(1);
}

export const env = parsed.data;
