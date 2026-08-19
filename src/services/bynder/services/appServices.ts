import { Request, Response } from 'express';
import { Template } from '../db/models/Template.model.js';
import { List } from '../db/models/List.model.js';
import { Note } from '../db/models/Note.model.js';
import { Plan } from '../db/models/Plan.model.js';
import { Subscription } from '../db/models/Subscription.model.js';
import Expense from '../db/models/Expense.model.js';
import Habit from '../db/models/Habit.model.js';
import Watchlist from '../db/models/Watchlist.model.js';
import Dream from '../db/models/Dream.model.js';
import Achievement from '../db/models/Achievement.model.js';
import Debt from '../db/models/Debt.model.js';
import { logger } from '../logger.js';
import { Project } from '../db/models/Project.model.js';

const timedConfigQuery = async <T>(dataset: string, query: Promise<T>): Promise<T> => {
  const startedAt = performance.now();
  const result = await query;
  const durationMs = Number((performance.now() - startedAt).toFixed(2));

  logger.info('Bynder config dataset loaded', {
    dataset,
    durationMs,
    slow: durationMs >= 500,
  });

  return result;
};

export const getConfig = async (req: Request, res: Response) => {
  const startedAt = performance.now();
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
      projects,
    ] = await Promise.all([
      timedConfigQuery('templates', Template.find().lean()),
      timedConfigQuery('lists', userId ? List.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery('notes', userId ? Note.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery('plans', userId ? Plan.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery(
        'subscriptions',
        userId ? Subscription.find({ userId }).lean() : Promise.resolve([]),
      ),
      timedConfigQuery('expenses', userId ? Expense.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery('habits', userId ? Habit.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery(
        'watchlist',
        userId ? Watchlist.find({ userId }).lean() : Promise.resolve([]),
      ),
      timedConfigQuery('dreams', userId ? Dream.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery(
        'achievements',
        userId ? Achievement.find({ userId }).lean() : Promise.resolve([]),
      ),
      timedConfigQuery('debts', userId ? Debt.find({ userId }).lean() : Promise.resolve([])),
      timedConfigQuery('projects', userId ? Project.find({ userId }).lean() : Promise.resolve([])),
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
      projects,
    };

    res.status(200).json(config);
    logger.info('Bynder config request completed', {
      durationMs: Number((performance.now() - startedAt).toFixed(2)),
      templateCount: templates.length,
      userId: String(userId),
    });
  } catch (error: any) {
    logger.error('Fetching application configuration failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
