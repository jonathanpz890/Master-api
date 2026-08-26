const router = require('express').Router();
const authenticationRoutes = require('./authenticationRoutes');
const userRoutes = require('./userRoutes');
const gameRoutes = require('./gameRoutes');
const paths = require('./paths');

router.get(paths.root, (_req, res) => {
  res.status(200).json({
    service: 'bingory',
    routes: {
      register: `POST ${paths.auth.base}${paths.auth.register}`,
      login: `POST ${paths.auth.base}${paths.auth.login}`,
      session: `GET ${paths.auth.base}${paths.auth.session}`,
      logout: `POST ${paths.auth.base}${paths.auth.logout}`,
      createGame: `POST ${paths.games.base}`,
      getGame: `GET ${paths.games.base}/:gameId`,
      joinGame: `POST ${paths.games.base}${paths.games.join}`,
      users: `GET|PATCH ${paths.users.base}`,
    },
  });
});

router.use(paths.auth.base, authenticationRoutes);
router.use(paths.games.base, gameRoutes);
router.use(paths.users.base, userRoutes);

module.exports = router;
