const { body } = require('express-validator');

module.exports = {
    createUser: [
        body('name').isString(),
        body('phone').isString().isLength({min: 10, max: 10}).withMessage('מספר טלפון לא תקין'),
        body('password').isString().isLength({min: 1, max: 18}).withMessage('סיסמא חייבת להכיל 1 עד 18 ספרות'),
    ],
    login: [
        body('phone').isString().isLength({min: 10, max: 10}),
        body('password').isString().isLength({min: 1, max: 18}),
    ],
    updateUser: [
        body('id').isMongoId(),
        body('gameId').isMongoId(),
        body('propertyId').isMongoId(),
        body('marked').isBoolean()
    ]
}