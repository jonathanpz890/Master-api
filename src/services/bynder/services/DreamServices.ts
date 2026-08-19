import { Request, Response } from 'express';
import Dream from '../db/models/Dream.model.js';

export const getDreams = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const dreams = await Dream.find({ userId }).sort({ date: -1 });
    res.json({ dreams });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createDream = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const dreamData = { ...req.body, userId };
    const newDream = new Dream(dreamData);
    await newDream.save();
    res.status(201).json({ dream: newDream });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateDream = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const updates = req.body;

    const dream = await Dream.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true },
    );

    if (!dream) {
      res.status(404).json({ error: 'Dream not found' });
      return;
    }

    res.json({ dream });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteDream = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const dream = await Dream.findOneAndDelete({ _id: id, userId });

    if (!dream) {
      res.status(404).json({ error: 'Dream not found' });
      return;
    }

    res.json({ message: 'Dream deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
