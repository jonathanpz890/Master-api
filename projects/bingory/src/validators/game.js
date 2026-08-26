const { body } = require('express-validator');

module.exports = {
    userJoinGame: [
        body('userId').isMongoId(),
        body('gameId').isMongoId()
    ]
}