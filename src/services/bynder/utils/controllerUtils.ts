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
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const details = typeof error?.message === 'string' ? error.message : undefined;
  // Expected client errors (for example, an unsupported video) can safely explain
  // what the user needs to change. Do not expose implementation errors from 5xxs.
  const clientMessage = status >= 400 && status < 500 && details ? details : message;

  res.status(status).json({
    error: message,
    message: clientMessage,
    ...(status >= 400 && status < 500 && details ? { details } : {}),
    ...(typeof error?.code === 'string' ? { code: error.code } : {}),
  });
};
