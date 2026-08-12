import express from 'express';
import { getDebts, createDebt, updateDebt, deleteDebt, addPayment } from '../services/DebtServices.js';

const debtsRouter = express.Router();

debtsRouter.get('/', getDebts);
debtsRouter.post('/', createDebt);
debtsRouter.put('/:id', updateDebt);
debtsRouter.delete('/:id', deleteDebt);
debtsRouter.post('/:id/payments', addPayment);

export default debtsRouter;
