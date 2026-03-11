import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

interface AppError extends Error {
  statusCode?: number;
}

export function globalErrorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(
    {
      err,
      method: req.method,
      url: req.url,
      body: req.method !== 'GET' ? req.body : undefined,
    },
    'Unhandled error'
  );

  if (err.message.startsWith('CORS:')) {
    res.status(403).json({ error: err.message });
    return;
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'خطأ داخلي في الخادم' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
