import { Request, Response } from "express";
import { Subscription } from "../db/models/Subscription.model.js";
import { ScanResult } from "../db/models/ScanResult.model.js";

export const getSubscriptions = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id;
        const subscriptions = await Subscription.find({ userId }).sort({ nextPaymentDate: 1 });
        res.status(200).json({ subscriptions });
    } catch (error: any) {
        console.error("Error fetching subscriptions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const createSubscription = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id;
        const { name, price, cycle, startDate, category, logo, notes } = req.body;

        // Calculate the next upcoming payment date based on cycle
        let nextPaymentDate = req.body.nextPaymentDate;
        if (!nextPaymentDate && startDate) {
            const start = new Date(startDate);
            const now = new Date();
            if (start > now) {
                nextPaymentDate = start;
            } else {
                const cycleMonths: Record<string, number> = {
                    Monthly: 1,
                    Quarterly: 3,
                    'Semi-Annual': 6,
                    Yearly: 12,
                };
                const months = cycleMonths[cycle] ?? 1;
                const next = new Date(start);
                while (next <= now) {
                    next.setMonth(next.getMonth() + months);
                }
                nextPaymentDate = next;
            }
        }

        const newSubscription = new Subscription({
            userId,
            name,
            price,
            cycle,
            startDate,
            nextPaymentDate,
            category,
            logo,
            notes
        });

        await newSubscription.save();
        res.status(201).json({ subscription: newSubscription });

    } catch (error: any) {
        console.error("Error creating subscription:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const updateSubscription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req.user as any)._id;

        // Strip fields that must never be overwritten by the client
        const { _id, __v, userId: _uid, createdAt, ...updates } = req.body;

        const subscription = await Subscription.findOneAndUpdate(
            { _id: id, userId },
            updates,
            { new: true }
        );

        if (!subscription) {
            res.status(404).json({ error: "Subscription not found" });
            return;
        }

        res.status(200).json({ subscription });

    } catch (error: any) {
        console.error("Error updating subscription:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const deleteSubscription = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req.user as any)._id;

        const subscription = await Subscription.findOneAndDelete({ _id: id, userId });

        if (!subscription) {
            res.status(404).json({ error: "Subscription not found" });
            return;
        }

        res.status(200).json({ message: "Subscription deleted successfully" });

    } catch (error: any) {
        console.error("Error deleting subscription:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const getScanResults = async (req: Request, res: Response) => {
    try {
        const { scanId } = req.params;
        const doc = await ScanResult.findOne({ scanId }).lean();

        if (!doc) {
            res.status(404).json({ error: "Scan results expired or not found" });
            return;
        }

        res.status(200).json({ results: doc.candidates });
    } catch (error: any) {
        console.error("Error getting scan results:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const bulkCreateSubscriptions = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id;
        const { subscriptions } = req.body;

        if (!Array.isArray(subscriptions)) {
            res.status(400).json({ error: "Subscriptions must be an array" });
            return;
        }

        const savedItems = [];
        for (const sub of subscriptions) {
            const newSub = new Subscription({
                ...sub,
                userId
            });
            await newSub.save();
            savedItems.push(newSub);
        }

        res.status(201).json({ subscriptions: savedItems });
    } catch (error: any) {
        console.error("Error bulk creating subscriptions:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
