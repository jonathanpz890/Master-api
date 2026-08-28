import type { Request, Response } from 'express';
import { List } from '../db/models/List.model.js';
import { Note } from '../db/models/Note.model.js';
import { Plan } from '../db/models/Plan.model.js';
import { Project } from '../db/models/Project.model.js';
import { Recipe } from '../db/models/Recipe.model.js';
import { Subscription } from '../db/models/Subscription.model.js';
import Expense from '../db/models/Expense.model.js';
import Habit from '../db/models/Habit.model.js';
import Watchlist from '../db/models/Watchlist.model.js';
import Dream from '../db/models/Dream.model.js';
import Achievement from '../db/models/Achievement.model.js';
import Debt from '../db/models/Debt.model.js';
import { MealPlan } from '../db/models/MealPlan.model.js';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const searchWorkspace = async (req: Request, res: Response): Promise<void> => {
  const query = String(req.query.q || '').trim();
  if (query.length < 2) {
    res.json({ results: [] });
    return;
  }

  const userId = (req.user as any)._id;
  const pattern = new RegExp(escapeRegex(query), 'i');
  const matches = (fields: string[]) => ({ userId, $or: fields.map((field) => ({ [field]: pattern })) });
  const limit = 8;

  try {
    const [lists, notes, projects, plans, recipes, subscriptions, expenses, habits, watchlist, dreams, achievements, debts, mealPlans] = await Promise.all([
      List.find(matches(['title', 'description', 'type', 'metadata.tags'])).select('title description type').limit(limit).lean(),
      Note.find(matches(['title', 'content', 'tags'])).select('title content tags').limit(limit).lean(),
      Project.find(matches(['title', 'description', 'status'])).select('title description status').limit(limit).lean(),
      Plan.find(matches(['title', 'description', 'type', 'items.title', 'items.notes', 'data.destination', 'data.savedPlaces.name'])).select('title description type items.title items.notes').limit(limit).lean(),
      Recipe.find(matches(['title', 'category', 'cookingMethod'])).select('title category').limit(limit).lean(),
      Subscription.find(matches(['name', 'category', 'notes'])).select('name category').limit(limit).lean(),
      Expense.find(matches(['title', 'category', 'notes'])).select('title category type').limit(limit).lean(),
      Habit.find(matches(['title', 'description', 'category'])).select('title description category').limit(limit).lean(),
      Watchlist.find(matches(['title', 'overview', 'notes'])).select('title type').limit(limit).lean(),
      Dream.find(matches(['title', 'content', 'tags', 'mood'])).select('title mood').limit(limit).lean(),
      Achievement.find(matches(['title', 'description', 'status', 'steps.title'])).select('title description status').limit(limit).lean(),
      Debt.find(matches(['title', 'person', 'notes', 'status'])).select('title person status').limit(limit).lean(),
      MealPlan.find(matches(['meals.customName', 'meals.notes'])).select('date meals.customName meals.notes').limit(limit).lean(),
    ]);

    const results = [
      ...lists.map((item: any) => ({ id: String(item._id), type: 'List', title: item.title, description: item.description || item.type || 'List', path: `/list/${item._id}` })),
      ...notes.map((item: any) => ({ id: String(item._id), type: 'Note', title: item.title || 'Untitled note', description: item.content?.replace(/\s+/g, ' ').slice(0, 90) || 'Note', path: `/notes?note=${item._id}` })),
      ...projects.map((item: any) => ({ id: String(item._id), type: 'Project', title: item.title, description: item.description || item.status || 'Project', path: `/project/${item._id}` })),
      ...plans.flatMap((item: any) => [
        { id: String(item._id), type: item.type || 'Plan', title: item.title, description: item.description || `${item.type || 'Plan'} plan`, path: `/plan/${item._id}` },
        ...(item.items ?? []).filter((planItem: any) => pattern.test(`${planItem.title || ''} ${planItem.notes || ''}`)).map((planItem: any, index: number) => ({ id: `${item._id}-${index}`, type: `${item.type || 'Plan'} item`, title: planItem.title, description: `In ${item.title}`, path: `/plan/${item._id}` })),
      ]),
      ...recipes.map((item: any) => ({ id: String(item._id), type: 'Recipe', title: item.title, description: item.category && item.category !== 'undefined' ? item.category : 'Recipe', path: `/tracking/recipes?recipeId=${item._id}` })),
      ...subscriptions.map((item: any) => ({ id: String(item._id), type: 'Subscription', title: item.name, description: item.category || 'Subscription', path: `/tracking/subscriptions?search=${encodeURIComponent(item.name)}` })),
      ...expenses.map((item: any) => ({ id: String(item._id), type: 'Expense', title: item.title, description: item.category || item.type || 'Expense', path: `/tracking/expenses?search=${encodeURIComponent(item.title)}` })),
      ...habits.map((item: any) => ({ id: String(item._id), type: 'Habit', title: item.title, description: item.description || item.category || 'Habit', path: `/tracking/habits?search=${encodeURIComponent(item.title)}` })),
      ...watchlist.map((item: any) => ({ id: String(item._id), type: 'Watchlist', title: item.title, description: item.type || 'Watchlist item', path: `/tracking/watchlist?search=${encodeURIComponent(item.title)}` })),
      ...dreams.map((item: any) => ({ id: String(item._id), type: 'Dream', title: item.title, description: item.mood || 'Dream journal entry', path: `/tracking/dreams?search=${encodeURIComponent(item.title)}` })),
      ...achievements.map((item: any) => ({ id: String(item._id), type: 'Achievement', title: item.title, description: item.description || item.status || 'Achievement', path: `/tracking/achievements?search=${encodeURIComponent(item.title)}` })),
      ...debts.map((item: any) => ({ id: String(item._id), type: 'Debt', title: item.title, description: item.person ? `With ${item.person}` : item.status || 'Debt', path: `/tracking/debts?search=${encodeURIComponent(item.title)}` })),
      ...mealPlans.flatMap((plan: any) => (plan.meals ?? []).filter((meal: any) => pattern.test(`${meal.customName || ''} ${meal.notes || ''}`)).map((meal: any, index: number) => ({ id: `${plan._id}-${index}`, type: 'Meal plan', title: meal.customName || 'Planned meal', description: `Meal planned for ${new Date(plan.date).toLocaleDateString()}`, path: `/planning/meals?search=${encodeURIComponent(meal.customName || '')}` }))),
    ];

    res.json({ results });
  } catch {
    res.status(500).json({ message: 'Unable to search your workspace' });
  }
};
