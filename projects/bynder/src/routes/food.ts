import express from 'express';
import authRouter from './auth.js';
import templatesRouter from './templates.js';
import { getConfig } from '../services/appServices.js';
import { clearListEntryImage, createList, createListEntry, deleteListEntry, getListById, getLists, updateListEntry, updateListEntryWithFile } from '../services/ListServices.js';
import multer from 'multer';
import path from 'path';
import { getIngredients, searchRecipes, getRandomRecipes, getRecipeInformation } from '../services/foodServices.js';

const foodRouter = express.Router();

foodRouter.get('/ingredients', getIngredients)
foodRouter.get('/recipes', searchRecipes)
foodRouter.get('/recipes/random', getRandomRecipes)
foodRouter.get('/recipes/:id', getRecipeInformation)

export default foodRouter;