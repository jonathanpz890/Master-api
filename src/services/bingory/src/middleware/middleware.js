const { validationResult } = require('express-validator');
const { logger } = require('../logger');

module.exports = {
  requireAuthentication: (req, res, next) => {
    if (req.isAuthenticated?.()) return next();
    return res.status(401).json({ message: 'נדרשת התחברות לחשבון' });
  },
  validateRequestSchema: (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      logger.warn('Request validation failed', { issueCount: errors.array().length });
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
};
