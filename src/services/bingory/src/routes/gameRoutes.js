const router = require('express').Router();
const Service = require('../services/game-functionality');
const Validator = require('../validators/game');
const Middleware = require('../middleware/middleware');

router.use(Middleware.requireAuthentication);

router.post('/', Validator.createGame, Middleware.validateRequestSchema, Service.createGame);
router.get('/:gameId', Service.getGame);
router.post('/join', Validator.userJoinGame, Middleware.validateRequestSchema, Service.userJoinGame);

module.exports = router;
