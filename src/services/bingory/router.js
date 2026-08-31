const express = require('express');
const mongoose = require('mongoose-bingory');
const mongooseBynder = require('mongoose-bynder');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcrypt');
const { logger } = require('./src/logger');
const routes = require('./src/routes/config.js');
const User = require('./src/entities/models/user');

let initialization;

const initializeBingory = () => {
  initialization ??= (async () => {
    const mongoUri = process.env.BINGORY_MONGO_URI;
    const sessionSecret = process.env.BINGORY_SESSION_SECRET;
    if (!mongoUri || !sessionSecret)
      throw new Error('BINGORY_MONGO_URI and BINGORY_SESSION_SECRET must be configured');

    logger.info('Connecting service database');
    await mongoose.connect(mongoUri);
    logger.info('Service database connected');
    passport.use(
      new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
        User.findOne({ email: email.toLowerCase().trim() }, {}, (error, user) => {
          if (error) return done(error);
          if (!user) return done(null, false, { message: 'כתובת אימייל או סיסמה שגויות' });
          bcrypt.compare(password, user.password, (compareError, matches) =>
            done(
              compareError,
              matches ? user : false,
              matches ? undefined : { message: 'כתובת אימייל או סיסמה שגויות' },
            ),
          );
        });
      }),
    );
    const googleClientId = process.env.BINGORY_GOOGLE_CLIENT_ID;
    const googleClientSecret = process.env.BINGORY_GOOGLE_CLIENT_SECRET;
    const serverUrl = process.env.BINGORY_SERVER_URL?.replace(/\/$/, '');

    // Google is optional until credentials are configured, so email/password
    // authentication keeps the service available during setup.
    if (googleClientId && googleClientSecret && serverUrl) {
      passport.use(
        'bingory-google',
        new GoogleStrategy(
          {
            clientID: googleClientId,
            clientSecret: googleClientSecret,
            callbackURL: `${serverUrl}/api/v1/bingory/auth/google/callback`,
          },
          async (_accessToken, _refreshToken, profile, done) => {
            try {
              const email = profile.emails?.[0]?.value?.trim().toLowerCase();
              if (!email) return done(null, false, { message: 'לא נמצאה כתובת אימייל בחשבון Google' });

              let user = await User.findOne({
                $or: [{ googleSubject: profile.id }, { email }],
              });
              if (user) {
                if (!user.googleSubject) {
                  user.googleSubject = profile.id;
                  await user.save();
                }
                return done(null, user);
              }

              user = await new User({
                name: profile.displayName?.trim() || email.split('@')[0],
                email,
                googleSubject: profile.id,
              }).save();
              return done(null, user);
            } catch (error) {
              return done(error);
            }
          },
        ),
      );
    }
    passport.serializeUser((user, done) =>
      done(null, {
        id: user.id,
        service: user.__authService === 'bynder' || user.googleId ? 'bynder' : 'bingory',
      }),
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

const isBingoryConnected = () => mongoose.connection.readyState === 1;

const createBingoryRouter = async () => {
  await initializeBingory();
  const mongoUri = process.env.BINGORY_MONGO_URI;
  const sessionSecret = process.env.BINGORY_SESSION_SECRET;

  const router = express.Router();
  router.use(express.json());
  router.use(express.urlencoded({ extended: false }));
  // CORS is applied once at the gateway so every service shares the same
  // explicit allow-list. Do not override it inside this mounted router.
  router.use(cookieParser());
  router.use(
    session({
      name: 'bingory.sid',
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        path: '/api/v1/bingory',
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

module.exports = { createBingoryRouter, initializeBingory, isBingoryConnected };
