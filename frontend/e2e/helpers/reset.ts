import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../../../backend');

export async function resetSeedData() {
  try {
    await execFileAsync('npm', ['run', 'data:seed:reset'], {
      cwd: backendDir,
      shell: true,
      env: process.env,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`reset seed data failed: ${message}`);
  }
}
