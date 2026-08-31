const router = require('express').Router();
const Service = require('../services/game-functionality');
const Validator = require('../validators/game');
const Middleware = require('../middleware/middleware');

router.use(Middleware.requireAuthentication);

router.post('/', Validator.createGame, Middleware.validateRequestSchema, Service.createGame);
router.get('/mine', Service.getMyGames);
router.get('/explore', Service.explorePublicGames);
router.get('/:gameId', Service.getGame);
router.post('/:gameId/comments', Validator.createComment, Middleware.validateRequestSchema, Service.createComment);
router.post('/join', Validator.userJoinGame, Middleware.validateRequestSchema, Service.userJoinGame);

module.exports = router;
