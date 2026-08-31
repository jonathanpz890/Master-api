const { body } = require('express-validator');

module.exports = {
  createGame: [
    body('title').isString().trim().isLength({ min: 2, max: 120 }).withMessage('יש להזין שם למשחק'),
    body('creator').optional().isString().trim().isLength({ max: 80 }),
    body('about').optional().isString().trim().isLength({ max: 1_000 }),
    body('visibility').optional().isIn(['public', 'private']),
    body('properties').isArray({ min: 1 }).withMessage('יש להזין לפחות ערך אחד למשחק'),
    body('properties.*.title').isString().trim().isLength({ min: 1, max: 120 }).withMessage('כל ערך במשחק חייב לכלול טקסט'),
  ],
  userJoinGame: [
    body('gameId').isMongoId(),
  ],
  createComment: [
    body('text').isString().trim().isLength({ min: 1, max: 500 }).withMessage('יש להזין תגובה'),
  ],
};
