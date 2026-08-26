const { body } = require('express-validator');

module.exports = {
  createGame: [
    body('title').isString().trim().isLength({ min: 2, max: 120 }).withMessage('יש להזין שם למשחק'),
    body('creator').optional().isString().trim().isLength({ max: 80 }),
    body('about').optional().isString().trim().isLength({ max: 1_000 }),
    body('properties').isArray({ min: 25, max: 100 }).withMessage('יש להזין לפחות 25 ערכים למשחק'),
    body('properties.*.title').isString().trim().isLength({ min: 1, max: 120 }).withMessage('כל ערך במשחק חייב לכלול טקסט'),
  ],
  userJoinGame: [
    body('gameId').isMongoId(),
  ],
};
