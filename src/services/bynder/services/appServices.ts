import { Request, Response } from 'express';
import { List } from '../db/models/List.model.js';
import { Note } from '../db/models/Note.model.js';
import { Subscription } from '../db/models/Subscription.model.js';
import Expense from '../db/models/Expense.model.js';
import Habit from '../db/models/Habit.model.js';
import Watchlist from '../db/models/Watchlist.model.js';
import { Plan } from '../db/models/Plan.model.js';
import { logger } from '../logger.js';
import { getDashboardPlans } from './planServices.js';

const currentMonthRange = (): { start: Date; end: Date } => {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 1),
  };
};

/**
 * A deliberately compact home-screen payload. Full collections belong to their
 * own routes and are loaded only after the user visits the relevant feature.
 */
export const getDashboard = async (req: Request, res: Response) => {
  const startedAt = performance.now();
  try {
    const userId = (req.user as any)?._id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { start, end } = currentMonthRange();
    const [
      plans,
      pinnedLists,
      listCount,
      pinnedNoteCount,
      watchlistCount,
      activePlanCount,
      subscriptions,
      expenseTotal,
      topHabits,
    ] = await Promise.all([
      getDashboardPlans(String(userId)),
      List.find({ userId, 'settings.pinned': true })
        .select('title entries settings.colorTheme settings.pinned')
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      List.countDocuments({ userId }),
      Note.countDocuments({ userId, pinned: true, archived: { $ne: true } }),
      Watchlist.countDocuments({ userId }),
      Plan.countDocuments({ userId, status: 'active' }),
      Subscription.find({ userId, active: true }).select('price cycle').lean(),
      Expense.aggregate<{ total: number }>([
        { $match: { userId, type: 'expense', date: { $gte: start, $lt: end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Habit.find({ userId }).select('title streak').sort({ streak: -1 }).limit(2).lean(),
    ]);

    const monthlySubscriptionTotal = subscriptions.reduce((total, subscription) => {
      const price = Number(subscription.price) || 0;
      switch (subscription.cycle) {
        case 'Yearly':
          return total + price / 12;
        case 'Weekly':
          return total + price * 4;
        case 'Daily':
          return total + price * 30;
        default:
          return total + price;
      }
    }, 0);

    res.status(200).json({
      dashboard: {
        plans,
        pinnedLists,
        summary: {
          listCount,
          activePlanCount,
          pinnedNoteCount,
          watchlistCount,
          monthlySubscriptionTotal,
          monthlyExpenseTotal: expenseTotal[0]?.total ?? 0,
          topHabits,
        },
      },
      // Keep feature-slice state safe. Their full collections are fetched only
      // when the user opens the relevant page.
      templates: [],
      lists: [],
      notes: [],
      plans: [],
      subscriptions: [],
      expenses: [],
      habits: [],
      watchlist: [],
      dreams: [],
      achievements: [],
      debts: [],
      projects: [],
    });

    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    if (durationMs >= 500) {
      logger.warn('Bynder dashboard request was slow', { durationMs, userId: String(userId) });
    } else {
      logger.info('Bynder dashboard request completed', { durationMs, userId: String(userId) });
    }
  } catch (error: any) {
    logger.error('Fetching dashboard data failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
