const router = require('express').Router();
const authenticationRoutes = require('./authenticationRoutes');
const userRoutes = require('./userRoutes');
const gameRoutes = require('./gameRoutes');

router.use('/', authenticationRoutes);
router.use('/user', userRoutes);
router.use('/game', gameRoutes);

module.exports = router;