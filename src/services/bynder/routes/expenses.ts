import express from 'express';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../services/ExpenseServices.js';

const expensesRouter = express.Router();

expensesRouter.get('/', getExpenses);
expensesRouter.post('/', createExpense);
expensesRouter.put('/:id', updateExpense);
expensesRouter.delete('/:id', deleteExpense);

export default expensesRouter;
