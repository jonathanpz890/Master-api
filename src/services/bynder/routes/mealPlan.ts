import express from 'express';
import * as mealPlanServices from '../services/mealPlanServices.js';
import { logger } from 'mnemonix';

const router = express.Router();

const ensureAuth = (req: any, res: any, next: any) => {
    if (req.isAuthenticated()) return next();
    res.status(401).json({ message: 'Unauthorized' });
};

router.get('/range', ensureAuth, async (req: any, res) => {
    try {
        const { start, end } = req.query;
        if (!start || !end) {
            res.status(400).json({ message: 'Start and end dates are required' });
            return;
        }
        const plans = await mealPlanServices.getMealPlansByRange(
            req.user.id,
            new Date(start as string),
            new Date(end as string)
        );
        res.json(plans);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/upsert', ensureAuth, async (req: any, res) => {
    try {
        const { date, meals } = req.body;
        const plan = await mealPlanServices.upsertMealPlan(req.user.id, date, meals);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/add', ensureAuth, async (req: any, res) => {
    try {
        const { date, meal } = req.body;
        const plan = await mealPlanServices.addMealRecord(req.user.id, date, meal);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/meal', ensureAuth, async (req: any, res) => {
    try {
        const { date, mealId, update } = req.body;
        const plan = await mealPlanServices.updateMealInPlan(req.user.id, date, mealId, update);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/meal', ensureAuth, async (req: any, res) => {
    try {
        const { date, mealId } = req.query;
        const plan = await mealPlanServices.removeMealFromPlan(req.user.id, date as string, mealId as string);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/move', ensureAuth, async (req: any, res) => {
    try {
        const { sourceDate, destDate, mealId, destCategory, sourceCategory, destIndex } = req.body;
        const result = await mealPlanServices.moveMealRecord(req.user.id, sourceDate, destDate, mealId, destCategory, sourceCategory, destIndex);
        res.json(result);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
