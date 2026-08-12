const router = require('express').Router();
const Validator = require('../validators/authentication');
const Service = require('../services/authentication-functionality');
const Middleware = require('../middleware/middleware');
const passport = require('passport');

router.post('/register', Validator.createUser, Middleware.validateRequestSchema,  Service.createUser);
router.post(
    '/login',
    passport.authenticate('local'),
    (req, res) => {
        res.send({
            user: req.user,
            session: req.session.id
        })
    }
)
router.get('/login', (req, res) => {
    const error = req.flash('error');
    res.render('login', { error });
});
router.post('/verify-session', (req, res) => {
    res.send(req.user)
})
router.post('/logout', (req, res) => {
    try {
        req.logout();
        res.sendStatus(200);
    } catch(error) {
        res.send(error)
    }
})



module.exports = router;