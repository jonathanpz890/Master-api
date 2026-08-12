import express from 'express';
import passport from 'passport';
import { authenticateUser, logoutUser } from '../services/userService.js';
import User from '../db/models/User.model.js';
import crypto from 'crypto';

const authRouter = express.Router();

// Allowlist of valid redirect origins. Add your mobile scheme here via env var.
const ALLOWED_REDIRECT_ORIGINS = [
    process.env.APP_URL,
    process.env.MOBILE_REDIRECT_SCHEME, // e.g. "bynder://"
].filter((url): url is string => Boolean(url));

function isValidRedirectUri(uri: string): boolean {
    if (process.env.NODE_ENV !== 'production') {
        return true;
    }
    
    if (ALLOWED_REDIRECT_ORIGINS.length === 0) return false;
    return ALLOWED_REDIRECT_ORIGINS.some(allowed => uri.startsWith(allowed));
}

authRouter.post('/authenticate', authenticateUser)
authRouter.post('/logout', logoutUser)

authRouter.post('/token-login', async (req: any, res: any) => {
    const { token } = req.body;
    if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
    }

    try {
        const user = await User.findOne({
            mobileToken: token,
            mobileTokenExpires: { $gt: new Date() }
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
                console.error('Error in req.login:', err);
                res.status(500).json({ error: 'Login failed' });
                return;
            }
            res.json({
                user,
                token: user.apiToken // Return the long-lived token
            });
        });
    } catch (error) {
        console.error('Token login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

authRouter.get('/google', (req, res, next) => {
    const state = req.query.redirect_uri ? Buffer.from(JSON.stringify({ redirect_uri: req.query.redirect_uri })).toString('base64') : undefined;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
        accessType: 'offline',
        prompt: 'consent',
        state
    })(req, res, next);
});

authRouter.get('/google/gmail', (req, res, next) => {
    const state = req.query.redirect_uri ? Buffer.from(JSON.stringify({
        redirect_uri: req.query.redirect_uri,
        flow: 'scan'
    })).toString('base64') : undefined;
    passport.authenticate('google', {
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
        accessType: 'online',
        prompt: 'select_account consent',
        includeGrantedScopes: true,
        state
    } as Parameters<typeof passport.authenticate>[1])(req, res, next);
});

authRouter.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    async function (req: any, res) {
        let redirectUrl = process.env.APP_URL!;
        let isScanFlow = false;

        if (req.query.state) {
            try {
                const state = JSON.parse(Buffer.from(req.query.state as string, 'base64').toString());
                if (state.redirect_uri) {
                    if (isValidRedirectUri(state.redirect_uri)) {
                        redirectUrl = state.redirect_uri;
                    } else {
                        console.error('Rejected invalid redirect_uri in OAuth state:', state.redirect_uri);
                        res.status(400).json({ message: 'Invalid redirect URI' });
                        return;
                    }
                }
                if (state.flow === 'scan') isScanFlow = true;
            } catch (e) {
                console.error('Failed to parse state', e);
            }
        }

        if (isScanFlow && req.tempGoogleAccessToken) {
            try {
                const { scanEmailsForSubscriptions } = await import('../services/emailService.js');
                const result = await scanEmailsForSubscriptions(req.user._id, req.tempGoogleAccessToken) as any;
                const separator = redirectUrl.includes('?') ? '&' : '?';
                redirectUrl += `${separator}scan_done=true&scan_id=${result.scanId}`;
            } catch (error: any) {
                console.error('Scan error in callback:', error);
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
                mobileTokenExpires: expires
            });
            const separator = redirectUrl.includes('?') ? '&' : '?';
            redirectUrl += `${separator}token=${token}`;
        }

        res.redirect(redirectUrl);
    });

export default authRouter;