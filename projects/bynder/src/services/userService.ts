import { Request, Response } from "express";
import User from "../db/models/User.model.js";

export const authenticateUser = async (req: Request, res: Response) => {
    try {
        if (!(req as any).isAuthenticated()) {
            res.status(401).json({ error: 'User is not authenticated' });
            return;
        }
        const user = (req as any).user;
        if (!user) {
            res.status(401).json({ error: 'User not found' });
            return;
        }
        // Refresh user from DB to get latest fields if needed, or rely on passport deserialization
        // Passport deserialization strategy typically fetches the user.
        res.json({ user });
        return;
    } catch (error) {
        console.error('Error authenticating user:', error);
        res.status(500).json({ error: 'Error authenticating user' });
    }
}

export const updateUser = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;
        if (!userId) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }

        const updates = req.body;
        // Whitelist allowed updates for security
        const allowedUpdates = ['subscriptionBudget', 'username', 'profilePicture', 'settings']; // Add others as needed
        const safeUpdates: any = {};

        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                safeUpdates[key] = updates[key];
            }
        });

        const updatedUser = await User.findByIdAndUpdate(userId, { $set: safeUpdates }, { new: true });

        if (!updatedUser) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        res.json({ user: updatedUser });

    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: "Failed to update user" });
    }
}

export const logoutUser = (req: Request, res: Response) => {
    (req as any).logout((err: any) => {
        if (err) {
            return res.status(500).json({ error: 'Error logging out' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Error destroying session' });
            }
            res.clearCookie('connect.sid'); // Default express-session cookie name
            res.status(200).json({ success: true });
        });
    });
};