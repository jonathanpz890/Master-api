import { Request, Response } from "express";
import { Template } from "../db/models/Template.model.js";
import { List } from "../db/models/List.model.js";
import { Note } from "../db/models/Note.model.js";
import { Plan } from "../db/models/Plan.model.js";
import { Subscription } from "../db/models/Subscription.model.js";
import Expense from "../db/models/Expense.model.js";
import Habit from "../db/models/Habit.model.js";
import Watchlist from "../db/models/Watchlist.model.js";
import Dream from "../db/models/Dream.model.js";
import Achievement from "../db/models/Achievement.model.js";
import Debt from "../db/models/Debt.model.js";
import { Project } from "../db/models/Project.model.js";

export const getConfig = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;

        // Fetch all data in parallel
        const [
            templates,
            lists,
            notes,
            plans,
            subscriptions,
            expenses,
            habits,
            watchlist,
            dreams,
            achievements,
            debts,
            projects
        ] = await Promise.all([
            Template.find().lean(),
            userId ? List.find({ userId }).lean() : Promise.resolve([]),
            userId ? Note.find({ userId }).lean() : Promise.resolve([]),
            userId ? Plan.find({ userId }).lean() : Promise.resolve([]),
            userId ? Subscription.find({ userId }).lean() : Promise.resolve([]),
            userId ? Expense.find({ userId }).lean() : Promise.resolve([]),
            userId ? Habit.find({ userId }).lean() : Promise.resolve([]),
            userId ? Watchlist.find({ userId }).lean() : Promise.resolve([]),
            userId ? Dream.find({ userId }).lean() : Promise.resolve([]),
            userId ? Achievement.find({ userId }).lean() : Promise.resolve([]),
            userId ? Debt.find({ userId }).lean() : Promise.resolve([]),
            userId ? Project.find({ userId }).lean() : Promise.resolve([])
        ]);

        const config = {
            templates,
            lists,
            notes,
            plans,
            subscriptions,
            expenses,
            habits,
            watchlist,
            dreams,
            achievements,
            debts,
            projects
        };

        res.status(200).json(config);
    } catch (error: any) {
        console.error("Error fetching config:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}