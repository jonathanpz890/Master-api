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
router.post('/login', passport.authenticate('local'), (req, res) => {
  res.send({
    user: req.user,
    session: req.session.id,
  });
});
router.get('/login', (req, res) => {
  const error = typeof req.flash === 'function' ? req.flash('error') : [];
  res.status(200).json({ error });
});
router.post('/verify-session', (req, res) => {
  res.send(req.user);
});
router.post('/logout', (req, res) => {
  req.logout((error) => {
    if (error) {
      logger.error('Bango logout failed', error);
      return res.status(500).json({ error: 'Unable to log out' });
    }
    req.session.destroy((sessionError) => {
      if (sessionError) {
        logger.error('Bango session destruction failed', sessionError);
        return res.status(500).json({ error: 'Unable to log out' });
      }
      res.clearCookie('bango.sid', { path: '/api/v1/bango' });
      return res.sendStatus(200);
    });
  });
});

module.exports = router;
