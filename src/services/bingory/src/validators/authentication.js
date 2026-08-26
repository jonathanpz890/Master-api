const { body } = require('express-validator');

module.exports = {
    createUser: [
        body('name').isString().trim().isLength({ min: 2, max: 80 }).withMessage('יש להזין שם מלא'),
        body('email').isEmail().normalizeEmail().withMessage('כתובת האימייל אינה תקינה'),
        body('password').isString().isLength({ min: 8, max: 72 }).withMessage('הסיסמה חייבת להכיל לפחות 8 תווים'),
    ],
    login: [
        body('email').isEmail().normalizeEmail().withMessage('כתובת האימייל אינה תקינה'),
        body('password').isString().isLength({ min: 8, max: 72 }).withMessage('הסיסמה אינה תקינה'),
    ],
    updateUser: [
        body('id').isMongoId(),
        body('gameId').isMongoId(),
        body('propertyId').isMongoId(),
        body('marked').isBoolean()
    ]
}
