import { Response } from 'express';
import { logger } from '../logger.js';

/**
 * Extracts userId from request user object robustly.
 */
export const getUserId = (req: any): string | null => {
  return req.user?.id || req.user?._id || null;
};

/**
 * Robustly parses a field that might be a JSON string (common in multipart forms).
 */
export const parseMultiformField = (field: any): any[] => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  try {
    return typeof field === 'string' ? JSON.parse(field) : field;
  } catch (e) {
    logger.error(`Failed to parse field: ${field}`, e);
    return [];
  }
};

/**
 * Standardized error handler for controllers.
 */
export const handleControllerError = (
  res: Response,
  error: any,
  message: string = 'Internal server error',
) => {
  logger.error(message, {
    error,
    status: error?.status,
  });
  const status = error.status || 500;
  res.status(status).json({
    error: message,
    details: error.message,
  });
};
