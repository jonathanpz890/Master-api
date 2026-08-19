import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
  SchemaType,
} from '@google/generative-ai';
import type { Schema } from '@google/generative-ai';
import dotenv from 'dotenv';
import { logger } from '../logger.js';

dotenv.config();

export const genAI = new GoogleGenerativeAI(process.env.BYNDER_GEMINI_API_KEY || '');

/**
 * Pin production to a stable model, while retaining a compatible alias as an
 * emergency fallback if Google retires that pinned version.
 */
export const PARSING_MODEL = process.env.BYNDER_GEMINI_MODEL?.trim() || 'gemini-2.5-flash';
export const PARSING_FALLBACK_MODEL =
  process.env.BYNDER_GEMINI_FALLBACK_MODEL?.trim() || 'gemini-flash-latest';
export const IMAGE_MODEL =
  process.env.BYNDER_GEMINI_IMAGE_MODEL?.trim() || 'gemini-3.1-flash-image';
export const IMAGE_FALLBACK_MODEL =
  process.env.BYNDER_GEMINI_IMAGE_FALLBACK_MODEL?.trim() || 'gemini-2.5-flash-image';

export const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

export const RECIPE_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    image: { type: SchemaType.STRING },
    ingredients: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          ingredient: {
            type: SchemaType.OBJECT,
            properties: {
              name: { type: SchemaType.STRING },
              imageSearchName: { type: SchemaType.STRING },
            },
            required: ['name', 'imageSearchName'],
          },
          unit: { type: SchemaType.STRING },
          amount: { type: SchemaType.STRING },
        },
        required: ['ingredient', 'unit', 'amount'],
      },
    },
    instructions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          text: { type: SchemaType.STRING },
          type: { type: SchemaType.STRING },
          ingredients: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: { name: { type: SchemaType.STRING } },
              required: ['name'],
            },
          },
        },
        required: ['text', 'type', 'ingredients'],
      },
    },
    category: { type: SchemaType.STRING },
    servings: { type: SchemaType.NUMBER },
    prepTime: { type: SchemaType.STRING },
    cookTime: { type: SchemaType.STRING },
    cookingMethod: { type: SchemaType.STRING },
    ovenTemp: { type: SchemaType.STRING },
    airFryTemp: { type: SchemaType.STRING },
  },
  required: [
    'title',
    'image',
    'ingredients',
    'instructions',
    'category',
    'servings',
    'prepTime',
    'cookTime',
    'cookingMethod',
    'ovenTemp',
    'airFryTemp',
  ],
};

const isUnavailableModelError = (error: unknown): boolean =>
  error instanceof Error &&
  /\b404\b|model.+(?:not found|no longer available|not available)/i.test(error.message);

const parsingModelNames = (): string[] => [
  ...new Set([PARSING_MODEL, PARSING_FALLBACK_MODEL].filter(Boolean)),
];

const createFailoverModel = (options: any) => {
  return {
    generateContent: async (...args: any[]) => {
      const modelNames = parsingModelNames();
      let lastError: unknown;
      for (const [index, modelName] of modelNames.entries()) {
        try {
          return await genAI
            .getGenerativeModel({ model: modelName, ...options })
            .generateContent(...args);
        } catch (error) {
          lastError = error;
          if (!isUnavailableModelError(error) || index === modelNames.length - 1) throw error;
          logger.warn('Configured Gemini model is unavailable; retrying fallback', {
            configuredModel: modelName,
            fallbackModel: modelNames[index + 1],
          });
        }
      }
      throw lastError;
    },
  };
};

const createParsingModel = (temperature?: number, schema?: Schema) =>
  createFailoverModel({
    safetySettings,
    generationConfig: {
      responseMimeType: 'application/json',
      ...(schema ? { responseSchema: schema } : {}),
      ...(temperature !== undefined ? { temperature } : {}),
    },
  });

export const getJsonModel = (temperature?: number, schema?: Schema) =>
  createParsingModel(temperature, schema);

/**
 * Creates a Gemini model for plain text generation.
 */
export const getTextModel = () => createFailoverModel({ safetySettings });

/**
 * Cleans markdown wrapper from AI response text.
 */
export const cleanJsonResponse = (text: string): string => {
  if (text.trim().startsWith('```')) {
    return text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
  }
  return text;
};
