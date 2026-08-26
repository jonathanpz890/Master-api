const router = require('express').Router();
const Validator = require('../validators/authentication');
const Service = require('../services/authentication-functionality');
const Middleware = require('../middleware/middleware');
const passport = require('passport');
const { logger } = require('../logger');

router.post(
  '/register',
  Validator.createUser,
  Middleware.validateRequestSchema,
  Service.createUser,
);
router.post('/login', Validator.login, Middleware.validateRequestSchema, passport.authenticate('local'), (req, res) => {
  res.status(200).json({
    user: req.user,
    session: req.session.id,
  });
});
router.get('/session', (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'נדרשת התחברות לחשבון' });
  return res.status(200).json({ user: req.user });
});
router.post('/logout', (req, res) => {
  req.logout((error) => {
    if (error) {
      logger.error('Bingory logout failed', error);
      return res.status(500).json({ error: 'Unable to log out' });
    }
    req.session.destroy((sessionError) => {
      if (sessionError) {
        logger.error('Bingory session destruction failed', sessionError);
        return res.status(500).json({ error: 'Unable to log out' });
      }
      res.clearCookie('bingory.sid', { path: '/api/v1/bingory' });
      return res.sendStatus(200);
    });
  });
});

module.exports = router;
