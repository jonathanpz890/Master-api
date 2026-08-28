import express from 'express';
import authRouter from './auth.js';
import templatesRouter from './templates.js';
import listsRouter from './lists.js';
import foodRouter from './food.js';
import recipeRouter from './recipe.js';
import planRouter from './plan.js';
import notesRouter from './notes.js';
import subscriptionsRouter from './subscriptions.js';
import expensesRouter from './expenses.js';
import habitRouter from './habits.js';
import watchlistRouter from './watchlist.js';
import dreamRouter from './dreams.js';
import achievementRouter from './achievements.js';
import projectRouter from './projects.js';
import debtsRouter from './debts.js';
import mealPlanRouter from './mealPlan.js';
import userRouter from './user.js';
import aiRouter from './ai.js';
import searchRouter from './search.js';
import { getDashboard } from '../services/appServices.js';
import { ensureAuth } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.use('/auth', authRouter);

// Protected routes — all require authentication
router.get('/dashboard', ensureAuth, getDashboard);
router.use('/template', ensureAuth, templatesRouter);
router.use('/list', ensureAuth, listsRouter);
router.use('/food', ensureAuth, foodRouter);
router.use('/recipe', ensureAuth, recipeRouter);
router.use('/plan', ensureAuth, planRouter);
router.use('/notes', ensureAuth, notesRouter);
router.use('/subscriptions', ensureAuth, subscriptionsRouter);
router.use('/expenses', ensureAuth, expensesRouter);
router.use('/habits', ensureAuth, habitRouter);
router.use('/watchlist', ensureAuth, watchlistRouter);
router.use('/dreams', ensureAuth, dreamRouter);
router.use('/achievements', ensureAuth, achievementRouter);
router.use('/projects', ensureAuth, projectRouter);
router.use('/debts', ensureAuth, debtsRouter);
router.use('/meal-plan', ensureAuth, mealPlanRouter);
router.use('/user', ensureAuth, userRouter);
router.use('/ai', ensureAuth, aiRouter);
router.use('/search', ensureAuth, searchRouter);


export default router;
