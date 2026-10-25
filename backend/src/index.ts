import { env } from './config/env';
import { createApp } from './app';
import { disconnectOnSignal } from './utils/prisma';

disconnectOnSignal();
createApp().listen(env.PORT, env.HOST, () => {
  console.log(`[ok] dcagent backend on http://${env.HOST}:${env.PORT} (POST /api/v1/<resource>/<action>)`);
});
