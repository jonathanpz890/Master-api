const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose-bango');
const mongooseBynder = require('mongoose-bynder');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { logger } = require('./src/logger');
const routes = require('./src/routes/config.js');
const User = require('./src/entities/models/user');

let initialization;

const initializeBango = () => {
  initialization ??= (async () => {
    const mongoUri = process.env.BANGO_MONGO_URI;
    const sessionSecret = process.env.BANGO_SESSION_SECRET;
    if (!mongoUri || !sessionSecret)
      throw new Error('BANGO_MONGO_URI and BANGO_SESSION_SECRET must be configured');

    logger.info('Connecting service database');
    await mongoose.connect(mongoUri);
    logger.info('Service database connected');
    passport.use(
      new LocalStrategy({ usernameField: 'phone' }, (phone, password, done) => {
        User.findOne({ phone }, {}, (error, user) => {
          if (error || !user) return done(error, user || false);
          bcrypt.compare(password, user.password, (compareError, matches) =>
            done(compareError, matches ? user : false),
          );
        });
      }),
    );
    passport.serializeUser((user, done) =>
      done(null, { id: user.id, service: user.googleId ? 'bynder' : 'bango' }),
    );
    passport.deserializeUser((serialized, done) => {
      const userModel = serialized.service === 'bynder' ? mongooseBynder.model('User') : User;
      userModel.findById(serialized.id, {}, done);
    });
  })().catch((error) => {
    logger.error('Service initialization failed', error);
    initialization = undefined;
    throw error;
  });
  return initialization;
};

const isBangoConnected = () => mongoose.connection.readyState === 1;

const createBangoRouter = async () => {
  await initializeBango();
  const mongoUri = process.env.BANGO_MONGO_URI;
  const sessionSecret = process.env.BANGO_SESSION_SECRET;

  const router = express.Router();
  router.use(express.json());
  router.use(express.urlencoded({ extended: false }));
  router.use(
    cors({
      origin: (process.env.BANGO_ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
      credentials: true,
    }),
  );
  router.use(cookieParser());
  router.use(
    session({
      name: 'bango.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        path: '/api/v1/bango',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 36_000_000_000,
      },
      store: MongoStore.create({ mongoUrl: mongoUri }),
    }),
  );
  router.use(passport.initialize());
  router.use(passport.session());
  router.use(routes);
  logger.info('Service router created');
  return router;
};

module.exports = { createBangoRouter, initializeBango, isBangoConnected };
