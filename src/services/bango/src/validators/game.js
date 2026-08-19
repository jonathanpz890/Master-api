const { body } = require('express-validator');

module.exports = {
  userJoinGame: [
    body('userId').isMongoId(),
    // The original client has used both `id` and `gameId`; accept either name.
    body('id').optional().isMongoId(),
    body('gameId').optional().isMongoId(),
    body().custom((_body, { req }) => {
      if (req.body.id || req.body.gameId) return true;
      throw new Error('A game id is required');
    }),
  ],
};
