import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import datacentersRouter from './routes/datacenters';
import roomsRouter from './routes/rooms';
import cabinetsRouter from './routes/cabinets';
import devicesRouter from './routes/devices';
import panelsRouter from './routes/panels';
import portsRouter from './routes/ports';
import cablesRouter from './routes/cables';
import cableShortIdPoolRouter from './routes/cableShortIdPool';
import shortIdPoolRouter from './routes/shortIdPool';
import searchRouter from './routes/search';
import panelTemplateRouter from './routes/panelTemplateRoutes';
import opticalModulesRouter from './routes/opticalModules';
import subnetsRouter from './routes/subnets';
import ipAddressesRouter from './routes/ipAddresses';
import workstationsRouter from './routes/workstations';
import { errorLogger, requestLogger } from './middleware/logger';

dotenv.config();

export function createApp(): Express {
  const app: Express = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'DCAgent Backend',
    });
  });

  app.get('/api/v1', (_req: Request, res: Response) => {
    res.json({
      message: 'DCAgent API v1',
      version: '1.0.0',
      endpoints: {
        datacenters: '/api/v1/datacenters',
        rooms: '/api/v1/rooms',
        cabinets: '/api/v1/cabinets',
        devices: '/api/v1/devices',
        panels: '/api/v1/panels',
        ports: '/api/v1/ports',
        cables: '/api/v1/cables',
        opticalModules: '/api/v1/optical-modules',
        subnets: '/api/v1/subnets',
        ipAddresses: '/api/v1/ip-addresses',
        workstations: '/api/v1/workstations',
        cableShortIdPool: '/api/v1/cable-shortid-pool',
        shortIdPool: '/api/v1/shortid-pool',
        search: '/api/v1/search',
        panelTemplates: '/api/v1/panel-templates',
      },
    });
  });

  app.use('/api/v1/datacenters', datacentersRouter);
  app.use('/api/v1/rooms', roomsRouter);
  app.use('/api/v1/cabinets', cabinetsRouter);
  app.use('/api/v1/devices', devicesRouter);
  app.use('/api/v1/panels', panelsRouter);
  app.use('/api/v1/ports', portsRouter);
  app.use('/api/v1/cables', cablesRouter);
  app.use('/api/v1/optical-modules', opticalModulesRouter);
  app.use('/api/v1/subnets', subnetsRouter);
  app.use('/api/v1/ip-addresses', ipAddressesRouter);
  app.use('/api/v1/workstations', workstationsRouter);
  app.use('/api/v1/cable-shortid-pool', cableShortIdPoolRouter);
  app.use('/api/v1/shortid-pool', shortIdPoolRouter);
  app.use('/api/v1/search', searchRouter);
  app.use('/api/v1/panel-templates', panelTemplateRouter);

  app.use((req: Request, res: Response) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] [404] ${req.method} ${req.path}`);
    }
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  if (process.env.NODE_ENV !== 'test') {
    app.use(errorLogger);
  }

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });

  return app;
}
