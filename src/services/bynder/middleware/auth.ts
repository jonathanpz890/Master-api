import { Request, Response, NextFunction } from 'express';
import User from '../db/models/User.model.js';
import { logger } from '../logger.js';

/**
 * Native clients cannot rely on the browser session cookie surviving an app
 * restart. They persist the long-lived token issued by /auth/token-login and
 * present it as a Bearer token instead.
 */
export const restoreApiTokenUser = async (req: Request, _res: Response, next: NextFunction) => {
  if (req.isAuthenticated() || req.user) {
    next();
    return;
  }

  const authorization = req.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    next();
    return;
  }

  try {
    const user = await User.findOne({ apiToken: match[1] });
    if (user) (req as any).user = user;
    next();
  } catch (error) {
    logger.error('Bynder API token restoration failed', error);
    next(error);
  }
};

export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated() || req.user) return next();
  logger.warn('Unauthenticated request rejected', {
    service: 'bynder',
    method: req.method,
    path: req.path,
    authenticated: req.isAuthenticated(),
    hasUser: Boolean((req as any).user),
  });
  res.status(401).json({ message: 'Unauthorized' });
};
