import express from 'express';
import { getIngredients, searchRecipes, getRandomRecipes, getRecipeInformation } from '../services/foodServices.js';

const foodRouter = express.Router();

foodRouter.get('/ingredients', getIngredients)
foodRouter.get('/recipes', searchRecipes)
foodRouter.get('/recipes/random', getRandomRecipes)
foodRouter.get('/recipes/:id', getRecipeInformation)

export default foodRouter;
