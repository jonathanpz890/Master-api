import { Request, Response } from 'express';
import Habit from '../db/models/Habit.model.js';
import { logger } from '../logger.js';

export const getHabits = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const habits = await Habit.find({ userId }).sort({ createdAt: -1 });
    res.json({ habits });
  } catch (error) {
    logger.error('Fetching habits failed', error);
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
};

export const createHabit = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const habitData = { ...req.body, userId };
    const newHabit = new Habit(habitData);
    await newHabit.save();
    res.status(201).json({ habit: newHabit });
  } catch (error) {
    logger.error('Creating habit failed', error);
    res.status(500).json({ error: 'Failed to create habit' });
  }
};

export const updateHabit = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;

    // Strip fields that must never be overwritten by the client
    const { _id, __v, userId: _uid, createdAt, ...updates } = req.body;

    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true },
    );

    if (!habit) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }

    res.json({ habit });
  } catch (error) {
    logger.error('Updating habit failed', error);
    res.status(500).json({ error: 'Failed to update habit' });
  }
};

export const logHabit = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { date, status, notes, mood } = req.body; // status: 'completed' | 'failed' | 'skipped'

    const habit = await Habit.findOne({ _id: id, userId });
    if (!habit) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }

    // Check if log for this date already exists
    const logIndex = habit.logs.findIndex((l) => l.date === date);
    if (logIndex !== -1) {
      habit.logs[logIndex].status = status;
      if (notes !== undefined) habit.logs[logIndex].notes = notes;
      if (mood !== undefined) habit.logs[logIndex].mood = mood;
    } else {
      habit.logs.push({ date, status, notes, mood });
    }

    // Recalculate streak: count consecutive completed days going back from today.
    // Missing days and 'skipped' days both break the streak; 'failed' also breaks it.
    const logMap = new Map(habit.logs.map((l) => [l.date, l.status]));
    let currentStreak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const status = logMap.get(dateStr);
      if (status === 'completed') {
        currentStreak++;
      } else if (status === 'skipped' && i === 0) {
        // Allow skipping today without breaking the streak
        continue;
      } else {
        break;
      }
    }
    habit.streak = currentStreak;

    await habit.save();
    res.json({ habit });
  } catch (error) {
    logger.error('Logging habit completion failed', error);
    res.status(500).json({ error: 'Failed to log habit' });
  }
};

export const deleteHabit = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const habit = await Habit.findOneAndDelete({ _id: id, userId });
    if (!habit) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }
    res.json({ message: 'Habit deleted successfully' });
  } catch (error) {
    logger.error('Deleting habit failed', error);
    res.status(500).json({ error: 'Failed to delete habit' });
  }
};

export const addUpdate = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { text } = req.body;

    const habit = await Habit.findOneAndUpdate(
      { _id: id, userId },
      { $push: { updates: { date: new Date(), text } } },
      { new: true },
    );

    if (!habit) {
      res.status(404).json({ error: 'Habit not found' });
      return;
    }

    res.json({ habit });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
