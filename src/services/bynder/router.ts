import express, { type Router } from 'express';
import MongoStore from 'connect-mongo';
import mongoose from 'mongoose-bynder';
import mongooseBingory from 'mongoose-bingory';
import passport from 'passport';
import fs from 'node:fs';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'node:path';

import { logger } from './logger.js';
import User from './db/models/User.model.js';
import routes from './routes/index.js';
import { restoreApiTokenUser } from './middleware/auth.js';

let initialization: Promise<void> | undefined;

const required = (name: 'BYNDER_MONGO_URI' | 'BYNDER_SESSION_SECRET'): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be configured`);
  return value;
};

export const initializeBynder = (): Promise<void> => {
  initialization ??= (async () => {
    const mongoUri = required('BYNDER_MONGO_URI');
    required('BYNDER_SESSION_SECRET');
    await mongoose.connect(mongoUri);

    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.BYNDER_GOOGLE_CLIENT_ID ?? '',
          clientSecret: process.env.BYNDER_GOOGLE_CLIENT_SECRET ?? '',
          callbackURL: `${process.env.BYNDER_SERVER_URL?.replace(/\/$/, '')}/auth/google/callback`,
          passReqToCallback: true,
        },
        async (
          request: Express.Request & { tempGoogleAccessToken?: string },
          accessToken,
          _refreshToken,
          _params,
          profile,
          done,
        ) => {
          try {
            request.tempGoogleAccessToken = accessToken;
            const email = profile.emails?.[0]?.value?.trim().toLowerCase();
            const existingUser = await User.findOne({
              $or: [{ googleId: profile.id }, ...(email ? [{ email }] : [])],
            });
            if (existingUser) {
              if (!existingUser.googleId) {
                existingUser.googleId = profile.id;
                if (!existingUser.profilePicture && profile.photos?.[0]?.value) {
                  existingUser.profilePicture = profile.photos[0].value;
                }
                await existingUser.save();
              }
              return done(null, existingUser);
            }
            const user = await new User({
              googleId: profile.id,
              username: profile.displayName,
              email,
              profilePicture: profile.photos?.[0]?.value,
              createdAt: new Date(),
            }).save();
            return done(null, user);
          } catch (error) {
            return done(error as Error);
          }
        },
      ),
    );
    passport.serializeUser(
      (user: Express.User & { id: string; googleId?: string; __authService?: string }, done) => {
        done(null, {
          id: user.id,
          service: user.__authService === 'bynder' || user.googleId ? 'bynder' : 'bingory',
        });
      },
    );
    passport.deserializeUser(
      async (serialized: { id: string; service: 'bingory' | 'bynder' }, done) => {
        try {
          if (serialized.service === 'bynder') {
            done(null, await User.findById(serialized.id));
            return;
          }
          done(null, await mongooseBingory.model('User').findById(serialized.id));
        } catch (error) {
          done(error as Error);
        }
      },
    );
  })().catch((error: unknown) => {
    logger.error('Service initialization failed', { service: 'bynder', error });
    initialization = undefined;
    throw error;
  });
  return initialization;
};

export const isBynderConnected = (): boolean => mongoose.connection.readyState === 1;

export const createBynderRouter = async (): Promise<Router> => {
  await initializeBynder();
  const router = express.Router();
  const imagesDirectory =
    process.env.BYNDER_IMAGES_DIR ?? path.resolve(process.cwd(), 'data/bynder/images');
  fs.mkdirSync(imagesDirectory, { recursive: true });

  router.use(express.json());
  router.use(express.urlencoded({ extended: true }));
  const session = (await import('express-session')).default;
  const sessionMiddleware = session({
    name: 'bynder.sid',
    secret: required('BYNDER_SESSION_SECRET'),
    resave: false,
    saveUninitialized: false,
    proxy: true,
    // Reuse Bynder's already-connected Mongoose pool. Previously connect-mongo
    // opened another Atlas client lazily on the first authenticated request.
    store: MongoStore.create({
      client: mongoose.connection.getClient(),
      stringify: false,
      autoRemove: 'native',
      touchAfter: 24 * 60 * 60,
    }),
    cookie: {
      path: '/api/v1/bynder',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    },
  });
  router.use((request, response, next) => {
    const startedAt = performance.now();
    sessionMiddleware(request, response, (error) => {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      if (durationMs >= 250) {
        logger.warn('Bynder session store was slow', {
          durationMs,
          method: request.method,
          path: request.path,
        });
      }
      next(error);
    });
  });
  router.use(passport.initialize());
  const passportSession = passport.session();
  router.use((request, response, next) => {
    const startedAt = performance.now();
    passportSession(request, response, (error) => {
      const durationMs = Number((performance.now() - startedAt).toFixed(2));
      if (durationMs >= 250) {
        logger.warn('Bynder Passport session restore was slow', {
          durationMs,
          method: request.method,
          path: request.path,
        });
      }
      next(error);
    });
  });
  router.use(restoreApiTokenUser);
  router.use('/images', express.static(imagesDirectory));
  router.use(routes);
  logger.info('Service router created', { service: 'bynder' });

  return router;
};
