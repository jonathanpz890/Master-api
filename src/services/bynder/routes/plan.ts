import express from 'express';
import * as planServices from '../services/planServices.js';
import { logger } from 'mnemonix';
import { ensureAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', ensureAuth, async (req: any, res) => {
    try {
        const { filter } = req.query;
        let plans;

        if (filter === 'dashboard') {
            plans = await planServices.getDashboardPlans(req.user.id);
        } else {
            plans = await planServices.getPlans(req.user.id);
        }

        res.json(plans);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.get('/:id', ensureAuth, async (req: any, res) => {
    try {
        const plan = await planServices.getPlanById(req.params.id, req.user.id);
        if (!plan) {
            res.status(404).json({ message: 'Plan not found' });
            return;
        }
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.post('/', ensureAuth, async (req: any, res) => {
    try {
        const plan = await planServices.createPlan(req.user.id, req.body);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id', ensureAuth, async (req, res) => {
    try {
        const plan = await planServices.updatePlan(req.params.id, req.body);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/:id', ensureAuth, async (req: any, res) => {
    try {
        const deleted = await planServices.deletePlan(req.params.id, req.user.id);
        if (!deleted) {
            res.status(404).json({ message: 'Plan not found' });
            return;
        }
        res.json({ message: 'Plan deleted' });
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

// Plan Items
router.post('/:id/item', ensureAuth, async (req, res) => {
    try {
        const plan = await planServices.addPlanItem(req.params.id, req.body);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.put('/:id/item/:itemId', ensureAuth, async (req, res) => {
    try {
        const plan = await planServices.updatePlanItem(req.params.id, req.params.itemId, req.body);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

router.delete('/:id/item/:itemId', ensureAuth, async (req, res) => {
    try {
        const plan = await planServices.deletePlanItem(req.params.id, req.params.itemId);
        res.json(plan);
    } catch (error: any) {
        logger.error(error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
