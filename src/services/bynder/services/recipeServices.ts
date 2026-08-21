import { Request, Response } from 'express';
import { Recipe } from '../db/models/Recipe.model.js';
import { RecipeLog } from '../db/models/RecipeLog.model.js';
import { logger } from '../logger.js';
import {
  parseRecipeFromInput,
  generateRecipeImage,
  parseRecipeFromImage,
  generateRecipeFromPrompt,
  generateRecipeConcepts,
} from './aiService.js';
import { getUserId, parseMultiformField, handleControllerError } from '../utils/controllerUtils.js';

export const generateImage = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, ingredients } = req.body;
    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    logger.info(`AI Generating image for recipe: "${title}" by user: ${userId}`);
    const imageUrl = await generateRecipeImage(title, ingredients || []);

    res.status(200).json({ imageUrl });
  } catch (error: any) {
    handleControllerError(res, error, 'Failed to generate image with AI');
  }
};

export const smartParseRecipeFromImage = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const image = req.file;
    if (!image) {
      res.status(400).json({ error: 'Image is required' });
      return;
    }

    logger.info(`AI Parsing recipe from image for user: ${userId}`);
    const parsedRecipe = await parseRecipeFromImage(image.buffer, image.mimetype);

    res.status(200).json({ recipe: parsedRecipe });
  } catch (error: any) {
    handleControllerError(res, error, 'Failed to parse recipe from image with AI');
  }
};

export const smartParseRecipe = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { input } = req.body;
    if (!input) {
      res.status(400).json({ error: 'Input is required' });
      return;
    }

    logger.info(`AI Parsing recipe request for user: ${userId}`);
    const parsedRecipe = await parseRecipeFromInput(input);

    res.status(200).json({ recipe: parsedRecipe });
  } catch (error: any) {
    handleControllerError(res, error, 'Failed to parse recipe with AI');
  }
};

export const getRecipes = async (req: Request, res: Response) => {
  const startedAt = performance.now();
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const recipes = await Recipe.find({ userId }).sort({ updatedAt: -1 }).lean();
    res.status(200).json({ recipes });
    const durationMs = Number((performance.now() - startedAt).toFixed(2));
    if (durationMs >= 500) {
      logger.warn('Bynder recipe library query was slow', {
        durationMs,
        recipeCount: recipes.length,
        userId,
      });
    }
  } catch (error: any) {
    handleControllerError(res, error, 'Error fetching recipes');
  }
};

export const createRecipe = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, servings, prepTime, cookTime, cookingMethod, ovenTemp, airFryTemp } = req.body;
    const ingredients = parseMultiformField(req.body.ingredients);
    const instructions = parseMultiformField(req.body.instructions);
    const category = req.body.category || 'Other';
    const image = req.file;

    logger.info(`Creating recipe: "${title}" for user: ${userId}`);

    let imageUrl = req.body.image || '';
    if (image) {
      imageUrl = `${process.env.BYNDER_SERVER_URL}/images/${image.filename}`;
    }

    const recipe = new Recipe({
      title,
      ingredients,
      instructions,
      category,
      servings: servings ? Number(servings) : undefined,
      prepTime,
      cookTime,
      cookingMethod,
      ovenTemp,
      airFryTemp,
      image: imageUrl,
      userId,
    });

    await recipe.save();
    res.status(201).json({ recipe });
  } catch (error: any) {
    handleControllerError(res, error, 'Error creating recipe');
  }
};

export const editRecipe = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { recipeId, title, servings, cookTime, prepTime, cookingMethod, ovenTemp, airFryTemp } =
      req.body;
    const ingredients = parseMultiformField(req.body.ingredients);
    const instructions = parseMultiformField(req.body.instructions);
    const category = req.body.category || 'Other';
    const image = req.file;

    const updateData: any = {
      title,
      ingredients,
      instructions,
      category,
      servings: servings ? Number(servings) : undefined,
      cookTime,
      prepTime,
      cookingMethod,
      ovenTemp,
      airFryTemp,
    };

    if (image) {
      updateData.image = `${process.env.BYNDER_SERVER_URL}/images/${image.filename}`;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }

    const recipe = await Recipe.findOneAndUpdate(
      { _id: recipeId, userId },
      { $set: updateData },
      { new: true },
    );

    if (!recipe) {
      res.status(404).json({ message: 'Recipe not found' });
      return;
    }

    res.status(200).json({ recipe });
  } catch (error: any) {
    handleControllerError(res, error, 'Error updating recipe');
  }
};

export const deleteRecipe = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { recipeId } = req.params;
    const recipe = await Recipe.findOneAndDelete({ _id: recipeId, userId });

    if (!recipe) {
      res.status(404).json({ message: 'Recipe not found' });
      return;
    }

    res.status(200).json({ message: 'Recipe deleted successfully', id: recipeId });
  } catch (error: any) {
    handleControllerError(res, error, 'Error deleting recipe');
  }
};

export const logMeal = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { recipeId, notes, rating } = req.body;
    const image = req.file;

    let imageUrl = req.body.image || '';
    if (image) {
      imageUrl = `${process.env.BYNDER_SERVER_URL}/images/${image.filename}`;
    }

    const recipeLog = new RecipeLog({
      userId,
      recipeId,
      notes,
      rating: rating ? Number(rating) : undefined,
      image: imageUrl,
      date: new Date(),
    });

    await recipeLog.save();
    res.status(201).json({ recipeLog });
  } catch (error: any) {
    handleControllerError(res, error, 'Error logging meal');
  }
};

export const getRecipeLogs = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { recipeId } = req.params;
    if (recipeId === 'preview') {
      res.status(200).json({ logs: [] });
      return;
    }

    const logs = await RecipeLog.find({ userId, recipeId }).sort({ date: -1 });
    res.status(200).json({ logs });
  } catch (error: any) {
    handleControllerError(res, error, 'Error fetching recipe logs');
  }
};

export const saveSpoonacularRecipe = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, image, ingredients, instructions, servings, prepTime, category } = req.body;

    const recipe = new Recipe({
      title,
      image,
      ingredients: (ingredients || []).map((ing: any) => ({
        ingredient: {
          name: ing.name,
          image: ing.image,
        },
        unit: ing.unit,
        amount: ing.amount,
      })),
      instructions: (instructions || []).map((inst: any) => ({
        text: inst.text || inst.step,
        type: inst.type || 'step',
        ingredients: (inst.ingredients || []).map((ing: any) => ({
          ingredient: {
            name: ing.name,
            image: ing.image,
          },
        })),
      })),
      category: category || 'Other',
      servings,
      prepTime,
      userId,
    });

    await recipe.save();
    res.status(201).json({ recipe });
  } catch (error: any) {
    handleControllerError(res, error, 'Error saving Spoonacular recipe');
  }
};

export const smartCreateRecipe = async (req: Request, res: Response) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { prompt, creativity, conceptTitle } = req.body;
    if (!prompt && !conceptTitle) {
      res.status(400).json({ error: 'Prompt or conceptTitle is required' });
      return;
    }

    if (conceptTitle) {
      logger.info(`AI Smart Create FINAL for user: ${userId}, Title: ${conceptTitle}`);
      const createdRecipe = await generateRecipeFromPrompt(conceptTitle, creativity);
      res.status(200).json({ recipe: createdRecipe });
    } else {
      logger.info(`AI Brainstorm Concepts for user: ${userId}, Creativity: ${creativity}`);
      const concepts = await generateRecipeConcepts(prompt, creativity);
      res.status(200).json({ concepts });
    }
  } catch (error: any) {
    handleControllerError(res, error, 'Failed to create recipe with AI');
  }
};
