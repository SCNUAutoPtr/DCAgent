import { Request, Response, NextFunction } from 'express';

/**
 * 格式化日志时间戳
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * 获取客户端IP
 */
function getClientIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket.remoteAddress ||
    'unknown'
  );
}

/**
 * 请求日志中间件
 * 记录所有HTTP请求的详细信息
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  // 记录请求开始
  console.log(`[${getTimestamp()}] [REQUEST ${requestId}] ${req.method} ${req.path}`);
  console.log(`  IP: ${getClientIp(req)}`);
  console.log(`  Query: ${JSON.stringify(req.query)}`);

  // 记录请求体（但不记录敏感信息）
  if (req.body && Object.keys(req.body).length > 0) {
    const safeBody = { ...req.body };
    // 隐藏可能的敏感字段
    ['password', 'token', 'secret'].forEach(field => {
      if (safeBody[field]) safeBody[field] = '***';
    });
    console.log(`  Body: ${JSON.stringify(safeBody)}`);
  }

  // 监听响应完成
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // 记录响应
    console.log(`[${getTimestamp()}] [RESPONSE ${requestId}] ${req.method} ${req.path}`);
    console.log(`  Status: ${statusCode}`);
    console.log(`  Duration: ${duration}ms`);

    // 如果是错误响应（4xx或5xx），记录响应内容
    if (statusCode >= 400) {
      console.error(`[${getTimestamp()}] [ERROR ${requestId}] ${statusCode} ${req.method} ${req.path}`);
      console.error(`  Request Query: ${JSON.stringify(req.query)}`);
      console.error(`  Request Params: ${JSON.stringify(req.params)}`);
      console.error(`  Request Body: ${JSON.stringify(req.body)}`);
      console.error(`  Response: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
      console.error(`  Duration: ${duration}ms`);
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * 错误日志中间件
 * 捕获并记录所有未处理的错误
 */
export function errorLogger(
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction
) {
  const timestamp = getTimestamp();

  console.error(`\n========== ERROR ==========`);
  console.error(`[${timestamp}] Unhandled Error`);
  console.error(`Request: ${req.method} ${req.path}`);
  console.error(`IP: ${getClientIp(req)}`);
  console.error(`Query: ${JSON.stringify(req.query)}`);
  console.error(`Params: ${JSON.stringify(req.params)}`);
  console.error(`Body: ${JSON.stringify(req.body)}`);
  console.error(`Error Name: ${err.name}`);
  console.error(`Error Message: ${err.message}`);
  console.error(`Stack Trace:\n${err.stack}`);
  console.error(`===========================\n`);

  // 继续传递错误到默认错误处理器
  next(err);
}
