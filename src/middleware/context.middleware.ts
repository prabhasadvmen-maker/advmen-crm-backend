import { Request, Response, NextFunction } from 'express';
import { asyncLocalStorage, RequestContext } from '../shared/context/asyncContext.js';

export function contextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers['x-request-id'] as string) || (req as any).id || `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Set header on response
  res.setHeader('X-Request-Id', requestId);

  const initialContext: RequestContext = {
    requestId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip || req.socket.remoteAddress,
  };

  asyncLocalStorage.run(initialContext, () => {
    next();
  });
}
