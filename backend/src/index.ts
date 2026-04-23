import { createApp } from './app';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const app = createApp();

app.listen(Number(PORT), HOST, () => {
  console.log(`Server is running on http://${HOST}:${PORT}`);
  console.log(`Health check: http://${HOST}:${PORT}/health`);
  console.log(`API endpoints: http://${HOST}:${PORT}/api/v1`);
  console.log(`API docs (需要安装依赖): http://${HOST}:${PORT}/api-docs`);
});

export default app;
