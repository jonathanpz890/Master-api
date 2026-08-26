/**
 * Public paths below /api/v1/bingory.
 *
 * Keeping this contract in one place makes it clear which URLs the Bingory
 * client may call and prevents route names from drifting between the UI and
 * the service.
 */
const paths = Object.freeze({
  root: '/',
  auth: Object.freeze({
    base: '/auth',
    register: '/register',
    login: '/login',
    session: '/session',
    logout: '/logout',
  }),
  games: Object.freeze({
    base: '/games',
    join: '/join',
  }),
  users: Object.freeze({
    base: '/users',
  }),
});

module.exports = paths;
