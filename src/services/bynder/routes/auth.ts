import express from 'express';
import passport from 'passport';
import bcrypt from 'bcrypt';
import { authenticateUser, logoutUser, toPublicUser } from '../services/userService.js';
import User from '../db/models/User.model.js';
import crypto from 'crypto';
import { logger } from '../logger.js';

const authRouter = express.Router();
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getCredentials = (body: unknown) => {
  const data = body as Record<string, unknown>;
  const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
  const password = typeof data?.password === 'string' ? data.password : '';
  return { email, password };
};

const establishSession = (req: any, res: any, user: any, status = 200) => {
  // The gateway shares Passport with Bingory. Mark this serialized identity so
  // a password user is always restored from the Bynder database.
  const sessionUser = {
    id: user.id ?? String(user._id),
    _id: user._id,
    googleId: user.googleId,
    __authService: 'bynder',
  };

  req.login(sessionUser, (error: unknown) => {
    if (error) {
      logger.error('Bynder password session creation failed', error);
      res.status(500).json({ error: 'Unable to start your session. Please try again.' });
      return;
    }
    res.status(status).json({ user: toPublicUser(user) });
  });
};

// Allowlist of valid redirect origins. Add your mobile scheme here via env var.
const ALLOWED_REDIRECT_ORIGINS = [
  process.env.BYNDER_APP_URL,
  process.env.BYNDER_MOBILE_REDIRECT_SCHEME, // e.g. "bynder://"
].filter((url): url is string => Boolean(url));

function isValidRedirectUri(uri: string): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }

  if (ALLOWED_REDIRECT_ORIGINS.length === 0) return false;
  return ALLOWED_REDIRECT_ORIGINS.some((allowed) => uri.startsWith(allowed));
}

authRouter.post('/authenticate', authenticateUser);
authRouter.post('/logout', logoutUser);

authRouter.post('/register', async (req: any, res: any) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const { email, password } = getCredentials(req.body);

  if (username.length < 2 || username.length > 80) {
    res.status(400).json({ error: 'Please enter a name between 2 and 80 characters.' });
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    res
      .status(400)
      .json({ error: `Your password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res
        .status(409)
        .json({ error: 'An account with that email already exists. Sign in instead.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await new User({ username, email, password: passwordHash }).save();
    establishSession(req, res, user, 201);
  } catch (error: any) {
    if (error?.code === 11000) {
      res
        .status(409)
        .json({ error: 'An account with that email already exists. Sign in instead.' });
      return;
    }
    logger.error('Bynder account registration failed', error);
    res.status(500).json({ error: 'Unable to create your account. Please try again.' });
  }
});

authRouter.post('/login', async (req: any, res: any) => {
  const { email, password } = getCredentials(req.body);
  if (!EMAIL_PATTERN.test(email) || !password) {
    res.status(400).json({ error: 'Enter your email address and password.' });
    return;
  }

  try {
    const user = await User.findOne({ email }).select('+password');
    const isPasswordValid =
      Boolean(user?.password) && (await bcrypt.compare(password, user.password!));
    if (!user || !isPasswordValid) {
      res.status(401).json({ error: 'Incorrect email address or password.' });
      return;
    }
    establishSession(req, res, user);
  } catch (error) {
    logger.error('Bynder password login failed', error);
    res.status(500).json({ error: 'Unable to sign in right now. Please try again.' });
  }
});

authRouter.post('/token-login', async (req: any, res: any) => {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: 'Token is required' });
    return;
  }

  try {
    const user = await User.findOne({
      mobileToken: token,
      mobileTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    // Clear the temporary token
    user.mobileToken = undefined;
    user.mobileTokenExpires = undefined;

    // Generate a long-lived apiToken if not exists
    if (!user.apiToken) {
      user.apiToken = crypto.randomBytes(64).toString('hex');
    }

    await user.save();

    // Log the user in to establish a session (for browsers that support it)
    req.login(user, (err: any) => {
      if (err) {
        logger.error('Bynder token login session creation failed', err);
        res.status(500).json({ error: 'Login failed' });
        return;
      }
      res.json({
        user: toPublicUser(user),
        token: user.apiToken, // Return the long-lived token
      });
    });
  } catch (error) {
    logger.error('Bynder token login failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

authRouter.get('/google', (req, res, next) => {
  const state = req.query.redirect_uri
    ? Buffer.from(JSON.stringify({ redirect_uri: req.query.redirect_uri })).toString('base64')
    : undefined;
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    accessType: 'offline',
    prompt: 'consent',
    state,
  })(req, res, next);
});

authRouter.get('/google/gmail', (req, res, next) => {
  const state = req.query.redirect_uri
    ? Buffer.from(
        JSON.stringify({
          redirect_uri: req.query.redirect_uri,
          flow: 'scan',
        }),
      ).toString('base64')
    : undefined;
  passport.authenticate('google', {
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'online',
    prompt: 'select_account consent',
    includeGrantedScopes: true,
    state,
  } as Parameters<typeof passport.authenticate>[1])(req, res, next);
});

authRouter.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  async function (req: any, res) {
    let redirectUrl = process.env.BYNDER_APP_URL!;
    let isScanFlow = false;

    if (req.query.state) {
      try {
        const state = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
        if (state.redirect_uri) {
          if (isValidRedirectUri(state.redirect_uri)) {
            redirectUrl = state.redirect_uri;
          } else {
            logger.warn('Rejected invalid OAuth redirect URI');
            res.status(400).json({ message: 'Invalid redirect URI' });
            return;
          }
        }
        if (state.flow === 'scan') isScanFlow = true;
      } catch (e) {
        logger.warn('Failed to parse OAuth state', e);
      }
    }

    if (isScanFlow && req.tempGoogleAccessToken) {
      try {
        const { scanEmailsForSubscriptions } = await import('../services/emailService.js');
        const result = (await scanEmailsForSubscriptions(
          req.user._id,
          req.tempGoogleAccessToken,
        )) as any;
        const separator = redirectUrl.includes('?') ? '&' : '?';
        redirectUrl += `${separator}scan_done=true&scan_id=${result.scanId}`;
      } catch (error: any) {
        logger.error('Gmail scan failed during OAuth callback', error);
        const separator = redirectUrl.includes('?') ? '&' : '?';
        const errorType = error.message === 'REAUTH_GMAIL' ? 'GMAIL_PERMISSION' : 'SCAN_FAILED';
        redirectUrl += `${separator}scan_error=${errorType}`;
      }
    }

    // Append a short-lived one-time token for both mobile deep-link redirects and web redirects.
    // This acts as a reliable fallback for mobile web browsers (like Safari) that block 3rd-party cookies.
    if (req.user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 5 * 60 * 1000);
      await User.findByIdAndUpdate((req.user as any)._id, {
        mobileToken: token,
        mobileTokenExpires: expires,
      });
      const separator = redirectUrl.includes('?') ? '&' : '?';
      redirectUrl += `${separator}token=${token}`;
    }

    res.redirect(redirectUrl);
  },
);

export default authRouter;
