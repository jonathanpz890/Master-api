const router = require('express').Router();
const Validator = require('../validators/authentication');
const Service = require('../services/user-functionality');
const middleware = require('../middleware/middleware');

router.get(
    '/',
    Service.getAllUsers
)

router.patch(
    '/',
    Validator.updateUser,
    middleware.validateRequestSchema,
    Service.updateUser
)

module.exports = router;