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
      google: `GET ${paths.auth.base}${paths.auth.google}`,
      session: `GET ${paths.auth.base}${paths.auth.session}`,
      logout: `POST ${paths.auth.base}${paths.auth.logout}`,
      createGame: `POST ${paths.games.base}`,
      myGames: `GET ${paths.games.base}${paths.games.mine}`,
      exploreGames: `GET ${paths.games.base}${paths.games.explore}`,
      getGame: `GET ${paths.games.base}/:gameId`,
      comment: `POST ${paths.games.base}/:gameId${paths.games.comments}`,
      joinGame: `POST ${paths.games.base}${paths.games.join}`,
      users: `GET|PATCH ${paths.users.base}`,
      profile: `PATCH ${paths.users.base}${paths.users.profile}`,
    },
  });
});

router.use(paths.auth.base, authenticationRoutes);
router.use(paths.games.base, gameRoutes);
router.use(paths.users.base, userRoutes);

module.exports = router;
