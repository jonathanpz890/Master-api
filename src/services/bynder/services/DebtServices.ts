import { Request, Response } from 'express';
import Debt from '../db/models/Debt.model.js';
import { logger } from '../logger.js';

export const getDebts = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const debts = await Debt.find({ userId }).sort({ createdAt: -1 });
    res.json({ debts });
  } catch (error) {
    logger.error('Fetching debts failed', error);
    res.status(500).json({ error: 'Failed to fetch debts' });
  }
};

export const createDebt = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { title, amount, person, type, dueDate, notes, status } = req.body;

    const newDebt = new Debt({
      userId,
      title,
      amount,
      person,
      type,
      dueDate,
      notes,
      status: status || 'pending',
    });

    await newDebt.save();
    res.status(201).json({ debt: newDebt });
  } catch (error) {
    logger.error('Creating debt failed', error);
    res.status(500).json({ error: 'Failed to create debt' });
  }
};

export const updateDebt = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const updates = req.body;

    const debt = await Debt.findOneAndUpdate({ _id: id, userId }, { $set: updates }, { new: true });

    if (!debt) {
      res.status(404).json({ error: 'Debt not found' });
      return;
    }

    res.json({ debt });
  } catch (error) {
    logger.error('Updating debt failed', error);
    res.status(500).json({ error: 'Failed to update debt' });
  }
};

export const deleteDebt = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;

    const debt = await Debt.findOneAndDelete({ _id: id, userId });

    if (!debt) {
      res.status(404).json({ error: 'Debt not found' });
      return;
    }

    res.json({ message: 'Debt deleted successfully' });
  } catch (error) {
    logger.error('Deleting debt failed', error);
    res.status(500).json({ error: 'Failed to delete debt' });
  }
};

export const addPayment = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const { amount, note, date } = req.body;

    const debt = await Debt.findOne({ _id: id, userId });
    if (!debt) {
      res.status(404).json({ error: 'Debt not found' });
      return;
    }

    debt.payments.push({
      amount,
      note,
      date: date || new Date(),
    });

    debt.totalPaid += amount;

    if (debt.totalPaid >= debt.amount) {
      debt.status = 'paid';
    } else if (debt.totalPaid > 0) {
      debt.status = 'partially_paid';
    }

    await debt.save();
    res.json({ debt });
  } catch (error) {
    logger.error('Adding debt payment failed', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
};
