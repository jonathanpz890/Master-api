import express from 'express';
import * as HabitServices from '../services/HabitServices.js';

const habitRouter = express.Router();

habitRouter.get('/', HabitServices.getHabits);
habitRouter.post('/', HabitServices.createHabit);
habitRouter.put('/:id', HabitServices.updateHabit);
habitRouter.post('/:id/log', HabitServices.logHabit);
habitRouter.post('/:id/update', HabitServices.addUpdate);
habitRouter.delete('/:id', HabitServices.deleteHabit);

export default habitRouter;
