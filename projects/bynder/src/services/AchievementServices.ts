import { Request, Response } from 'express';
import Achievement from '../db/models/Achievement.model.js';

export const getAchievements = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;
        const achievements = await Achievement.find({ userId }).sort({ createdAt: -1 });
        res.json({ achievements });
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ error: 'Failed to fetch achievements' });
    }
};

export const createAchievement = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;
        const achievementData = { ...req.body, userId };
        const newAchievement = new Achievement(achievementData);
        await newAchievement.save();
        res.status(201).json({ achievement: newAchievement });
    } catch (error) {
        console.error('Error creating achievement:', error);
        res.status(500).json({ error: 'Failed to create achievement' });
    }
};

export const updateAchievement = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;
        const { id } = req.params;
        const updates = req.body;

        const achievement = await Achievement.findOneAndUpdate(
            { _id: id, userId },
            { $set: updates },
            { new: true }
        );

        if (!achievement) {
            res.status(404).json({ error: 'Achievement not found' });
            return;
        }

        res.json({ achievement });
    } catch (error) {
        console.error('Error updating achievement:', error);
        res.status(500).json({ error: 'Failed to update achievement' });
    }
};

export const deleteAchievement = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;
        const { id } = req.params;
        const achievement = await Achievement.findOneAndDelete({ _id: id, userId });
        if (!achievement) {
            res.status(404).json({ error: 'Achievement not found' });
            return;
        }
        res.json({ message: 'Achievement deleted successfully' });
    } catch (error) {
        console.error('Error deleting achievement:', error);
        res.status(500).json({ error: 'Failed to delete achievement' });
    }
};

export const toggleStep = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)?._id;
        const { id, stepId } = req.params;

        const achievement = await Achievement.findOne({ _id: id, userId });
        if (!achievement) {
            res.status(404).json({ error: 'Achievement not found' });
            return;
        }

        const step = (achievement.steps as any).id(stepId);
        if (!step) {
            res.status(404).json({ error: 'Step not found' });
            return;
        }

        step.completed = !step.completed;

        // Check if all steps are completed
        const allCompleted = achievement.steps.every(s => s.completed);
        achievement.status = allCompleted ? 'completed' : 'in_progress';

        await achievement.save();
        res.json({ achievement });
    } catch (error) {
        console.error('Error toggling achievement step:', error);
        res.status(500).json({ error: 'Failed to toggle step' });
    }
};
