import express from 'express';
import {
    createSubscription,
    deleteSubscription,
    getSubscriptions,
    updateSubscription,
    getScanResults,
    bulkCreateSubscriptions
} from '../services/SubscriptionServices.js';

const subscriptionsRouter = express.Router();

subscriptionsRouter.get('/', getSubscriptions);
subscriptionsRouter.get('/scan-results/:scanId', getScanResults);
subscriptionsRouter.post('/', createSubscription);
subscriptionsRouter.post('/bulk', bulkCreateSubscriptions);
subscriptionsRouter.put('/:id', updateSubscription);
subscriptionsRouter.delete('/:id', deleteSubscription);

export default subscriptionsRouter;
