import { Request, Response, NextFunction } from 'express';
import { logger } from '../logger.js';

export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) return next();
  logger.warn('Unauthenticated request rejected', {
    service: 'bynder',
    method: req.method,
    path: req.path,
    authenticated: req.isAuthenticated(),
    hasUser: Boolean((req as any).user),
  });
  res.status(401).json({ message: 'Unauthorized' });
};
