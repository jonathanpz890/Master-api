import express from 'express';
import multer from 'multer';
import { createRecipe, editRecipe, getRecipes, deleteRecipe, logMeal, getRecipeLogs, saveSpoonacularRecipe, smartParseRecipe, generateImage, smartCreateRecipe, smartParseRecipeFromImage } from '../services/recipeServices.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        cb(null, process.env.BYNDER_IMAGES_DIR ?? path.resolve(process.cwd(), 'data/bynder/images'));
    },
    filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
};

const fileUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: imageFilter,
});

// Memory storage for endpoints that only need the buffer, not a persisted file
const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: imageFilter,
});
const recipeRouter = express.Router();

recipeRouter.get('/', getRecipes)
recipeRouter.post('/', fileUpload.single('image'), createRecipe)
recipeRouter.put('/', fileUpload.single('image'), editRecipe)
recipeRouter.delete('/:recipeId', deleteRecipe)

recipeRouter.post('/log', fileUpload.single('image'), logMeal)
recipeRouter.get('/log/:recipeId', getRecipeLogs)
recipeRouter.post('/save-spoonacular', saveSpoonacularRecipe)
recipeRouter.post('/smart-parse', smartParseRecipe)
recipeRouter.post('/smart-parse-image', memoryUpload.single('image'), smartParseRecipeFromImage)
recipeRouter.post('/smart-create', smartCreateRecipe)
recipeRouter.post('/generate-image', generateImage)

export default recipeRouter;
