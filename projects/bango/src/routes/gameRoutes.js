const router = require('express').Router();
const Service = require('../services/game-functionality');
const Validator = require('../validators/game');

router.get(
    '/:id',
    Service.getGame
)
router.post(
    '/user-join-game',
    Validator.userJoinGame,
    Service.userJoinGame
)

module.exports = router;