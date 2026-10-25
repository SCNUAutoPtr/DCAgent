import cors from 'cors';
import express, { type Express } from 'express';
import { env } from './config/env';
import { AppError, errorBody, errorMiddleware } from './http/errors';
import { requestLogger } from './middleware/logger';
import { cablesRouter } from './routes/cables';
import { deviceModelsRouter, devicesRouter } from './routes/devices';
import { cabinetsRouter, dataCentersRouter, roomsRouter } from './routes/hierarchy';
import { ipAddressesRouter, subnetsRouter } from './routes/ip';
import { labelsRouter } from './routes/labels';
import { dashboardRouter, searchRouter } from './routes/misc';
import { observabilityRouter } from './routes/observability';
import { opticalModulesRouter } from './routes/opticalModules';
import { panelsRouter, portsRouter } from './routes/panels';
import { panelTemplatesRouter } from './routes/panelTemplates';
import { workstationsRouter } from './routes/workstations';

const RESOURCES: Record<string, () => express.Router> = {
  datacenters: dataCentersRouter,
  rooms: roomsRouter,
  cabinets: cabinetsRouter,
  devices: devicesRouter,
  'device-models': deviceModelsRouter,
  panels: panelsRouter,
  ports: portsRouter,
  cables: cablesRouter,
  labels: labelsRouter,
  'optical-modules': opticalModulesRouter,
  subnets: subnetsRouter,
  'ip-addresses': ipAddressesRouter,
  workstations: workstationsRouter,
  observability: observabilityRouter,
  'panel-templates': panelTemplatesRouter,
  search: searchRouter,
  dashboard: dashboardRouter,
};

/** Every API call is POST /api/v1/<resource>/<action> with a JSON body. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: env.CORS_ORIGIN.split(',').map((s) => s.trim()) }));
  // flow ingest posts up to 50k goflow2 lines at once
  app.use(express.json({ limit: '20mb' }));
  if (env.NODE_ENV !== 'test') app.use(requestLogger);

  app.post('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'dcagent-backend', time: new Date().toISOString() });
  });

  for (const [name, make] of Object.entries(RESOURCES)) app.use(`/api/v1/${name}`, make());

  app.use((req, res) => {
    res.status(404).json(errorBody(new AppError('NOT_FOUND', `no route ${req.method} ${req.path}`, null)));
  });
  app.use(errorMiddleware);
  return app;
}
