import { Request, Response } from 'express';
import Expense from '../db/models/Expense.model.js';
import { logger } from '../logger.js';

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const expenses = await Expense.find({ userId }).sort({ date: -1 });
    res.json({ expenses });
  } catch (error) {
    logger.error('Fetching expenses failed', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

export const createExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { title, amount, category, date, type, notes } = req.body;

    const newExpense = new Expense({
      userId,
      title,
      amount,
      category,
      date,
      type,
      notes,
    });

    await newExpense.save();
    res.status(201).json({ expense: newExpense });
  } catch (error) {
    logger.error('Creating expense failed', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
};

export const updateExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;
    const updates = req.body;

    const expense = await Expense.findOneAndUpdate(
      { _id: id, userId },
      { $set: updates },
      { new: true },
    );

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    res.json({ expense });
  } catch (error) {
    logger.error('Updating expense failed', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?._id;
    const { id } = req.params;

    const expense = await Expense.findOneAndDelete({ _id: id, userId });

    if (!expense) {
      res.status(404).json({ error: 'Expense not found' });
      return;
    }

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    logger.error('Deleting expense failed', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};
