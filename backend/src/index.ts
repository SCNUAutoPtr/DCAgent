import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
// import swaggerUi from 'swagger-ui-express';  // 需要安装: npm install swagger-ui-express
// import YAML from 'yamljs';  // 需要安装: npm install yamljs @types/yamljs
import datacentersRouter from './routes/datacenters';
import roomsRouter from './routes/rooms';
import cabinetsRouter from './routes/cabinets';
import devicesRouter from './routes/devices';
import panelsRouter from './routes/panels';
import portsRouter from './routes/ports';
import cablesRouter from './routes/cables';
import searchRouter from './routes/search';
import panelTemplateRouter from './routes/panelTemplateRoutes';
// import monitoringRouter from './routes/monitoring'; // SNMP 监控模块已隐藏
import { requestLogger, errorLogger } from './middleware/logger';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口

// 加载 OpenAPI 文档（需要先安装依赖）
// const openApiDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 日志中间件（放在所有路由之前）
app.use(requestLogger);

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'DCAgent Backend'
  });
});

// API Routes
app.get('/api/v1', (req: Request, res: Response) => {
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
      search: '/api/v1/search',
      panelTemplates: '/api/v1/panel-templates',
      // monitoring: '/api/v1/monitoring' // SNMP 监控模块已隐藏
    }
  });
});

// Mount routers
app.use('/api/v1/datacenters', datacentersRouter);
app.use('/api/v1/rooms', roomsRouter);
app.use('/api/v1/cabinets', cabinetsRouter);
app.use('/api/v1/devices', devicesRouter);
app.use('/api/v1/panels', panelsRouter);
app.use('/api/v1/ports', portsRouter);
app.use('/api/v1/cables', cablesRouter);
app.use('/api/v1/search', searchRouter);
app.use('/api/v1/panel-templates', panelTemplateRouter);
// app.use('/api/v1/monitoring', monitoringRouter); // SNMP 监控模块已隐藏

// Swagger UI (需要先安装依赖: npm install swagger-ui-express yamljs @types/yamljs)
// app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));

// 404 handler (在错误处理之前)
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] [404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not Found', path: req.path });
});

// Error handling (使用日志中间件)
app.use(errorLogger);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(Number(PORT), HOST, () => {
  console.log(`🚀 Server is running on http://${HOST}:${PORT}`);
  console.log(`📊 Health check: http://${HOST}:${PORT}/health`);
  console.log(`📡 API endpoints: http://${HOST}:${PORT}/api/v1`);
  console.log(`📖 API docs (需要安装依赖): http://${HOST}:${PORT}/api-docs`);
});

export default app;
