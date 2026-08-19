import axios from 'axios';
import { Request, Response } from 'express';
import { logger } from '../logger.js';

const SPOONCULAR_API_URL = process.env.BYNDER_SPOONCULAR_API_URL;
const SPOONCULAR_API_KEY = process.env.BYNDER_SPOONCULAR_API_KEY;

export const getIngredients = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;
    // Ingredients are under /food/ingredients
    const ingredients = await axios.get(
      `${SPOONCULAR_API_URL}/food/ingredients/search?query=${query}&apiKey=${SPOONCULAR_API_KEY}`,
    );

    res.status(200).json({ ingredients: ingredients.data });
  } catch (error: any) {
    logger.error('Fetching food ingredients failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchRecipes = async (req: Request, res: Response) => {
  try {
    const { query, cuisine, diet, type, number = 10 } = req.query;
    // Recipes are under /recipes/complexSearch
    let url = `${SPOONCULAR_API_URL}/recipes/complexSearch?apiKey=${SPOONCULAR_API_KEY}&query=${query || ''}&number=${number}`;

    if (cuisine) url += `&cuisine=${cuisine}`;
    if (diet) url += `&diet=${diet}`;
    if (type) url += `&type=${type}`;
    url += '&addRecipeInformation=true&fillIngredients=true';

    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error: any) {
    logger.error('Fetching food recipes failed', error);
    res.status(500).json({ error: 'Failed to search recipes' });
  }
};

export const getRandomRecipes = async (req: Request, res: Response) => {
  try {
    const { tags, number = 10 } = req.query;
    // Random recipes are under /recipes/random
    const url = `${SPOONCULAR_API_URL}/recipes/random?apiKey=${SPOONCULAR_API_KEY}&tags=${tags || ''}&number=${number}`;

    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error: any) {
    logger.error('Fetching food recipe details failed', error);
    res.status(500).json({ error: 'Failed to fetch random recipes' });
  }
};

export const getRecipeInformation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Recipe info is under /recipes/{id}/information
    const url = `${SPOONCULAR_API_URL}/recipes/${id}/information?apiKey=${SPOONCULAR_API_KEY}&includeNutrition=true`;

    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error: any) {
    logger.error('Fetching food random recipes failed', error);
    res.status(500).json({ error: 'Failed to fetch recipe information' });
  }
};
