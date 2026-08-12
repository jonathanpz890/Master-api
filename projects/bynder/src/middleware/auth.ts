import { Request, Response, NextFunction } from 'express';

export const ensureAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) return next();
    console.log(`[AUTH] Authentication failed for ${req.method} ${req.originalUrl}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Is Authenticated (Passport):', req.isAuthenticated());
    console.log('User:', (req as any).user ? (req as any).user._id : 'None');
    res.status(401).json({ message: 'Unauthorized' });
};
