import 'dotenv/config';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import User from './db/models/User.model.js';
import router from './routes/index.js';
import { logger } from 'mnemonix';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';

// Trust proxy is required for secure cookies behind a load balancer (DigitalOcean)
app.set('trust proxy', 1);

// Middleware
app.use(async (req, res, next) => {
    // 1. Initial logging
    logger.info(`Incoming request: ${req.method} ${req.originalUrl || req.url}`);
    next();
});

app.use(express.json());
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || process.env.NODE_ENV !== 'production') {
            callback(null, true);
        } else {
            if (origin === process.env.APP_URL) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
    },
    credentials: true,
}));
app.use(express.urlencoded({ extended: true }));

if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required');
}

app.use(session({
    name: 'bynder.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    store: MongoStore.create({
        mongoUrl: MONGO_URI,
        stringify: false,
        autoRemove: 'native',
    }),
    cookie: {
        path: process.env.SESSION_COOKIE_PATH || '/',
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 * 30
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// Token auth cache — avoids a DB round-trip on every request
const tokenCache = new Map<string, { user: any; expires: number }>();
const TOKEN_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Token-based authentication fallback AFTER passport session
app.use(async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const cached = tokenCache.get(token);
            if (cached && cached.expires > Date.now()) {
                (req as any).user = cached.user;
                (req as any).isAuthenticated = () => true;
            } else {
                const user = await User.findOne({ apiToken: token });
                if (user) {
                    tokenCache.set(token, { user, expires: Date.now() + TOKEN_CACHE_TTL });
                    (req as any).user = user;
                    (req as any).isAuthenticated = () => true;
                } else {
                    logger.warn(`[AUTH] Token authentication failed: Invalid token - ${token.substring(0, 8)}...`);
                }
            }
        } catch (error) {
            logger.error(`[AUTH] Token auth error: ${error}`);
        }
    } else if (authHeader) {
        logger.warn(`[AUTH] Received non-Bearer Authorization header: ${authHeader.substring(0, 15)}...`);
    }
    next();
});

// Global 401 logging
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function (body) {
        if (res.statusCode === 401) {
            const userId = (req.user as any)?._id;
            logger.error(`[AUTH] 401 Unauthorized: ${req.method} ${req.originalUrl || req.url} - User: ${userId || 'None'} - Response: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
        }
        return originalSend.apply(res, arguments as any);
    };
    next();
});

// Passport Authentication
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: `${process.env.SERVER_URL?.replace(/\/$/, '')}/auth/google/callback`,
    passReqToCallback: true
},
    async (req: any, accessToken: string, refreshToken: string, params: any, profile: any, cb: any) => {
        const existingUser = await User.findOne({ googleId: profile.id });

        // Temporarily attach to req for the scan flow (or any other transient flow)
        req.tempGoogleAccessToken = accessToken;

        if (existingUser) {
            return cb(null, existingUser);
        }

        const newUser = await new User({
            googleId: profile.id,
            username: profile.displayName,
            email: profile.emails?.[0].value,
            profilePicture: profile.photos?.[0].value,
            createdAt: new Date(),
        }).save();
        cb(null, newUser);
    }
));

passport.serializeUser((user: any, done: (err: any, id?: any) => void) => {
    done(null, user.id);
})
passport.deserializeUser(async (id: any, done: (err: any, user?: any) => void) => {
    const user = await User.findById(id);
    if (user) {
        done(null, user);
    }
})

// Routes
app.use('/images', express.static(path.join(__dirname, '../images')));
app.get('/', (req, res) => {
    res.send('Hello World');
});
app.use(router);

// Start the server
async function startServer() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI);
        logger.info('Connected to MongoDB');

        // Start the server
        app.listen(PORT, () => {
            logger.info(`Server is running on ${process.env.SERVER_URL}`);
        });
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
        process.exit(1);
    }
}

startServer();
