import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, SchemaType } from "@google/generative-ai";
import type { Schema } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

export const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export const PARSING_MODEL = "gemini-2.0-flash";
export const IMAGE_MODEL = "gemini-2.0-flash-exp"; // supports native image generation

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
                        properties: { name: { type: SchemaType.STRING } },
                        required: ["name"]
                    },
                    unit: { type: SchemaType.STRING },
                    amount: { type: SchemaType.STRING }
                },
                required: ["ingredient", "unit", "amount"]
            }
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
                            required: ["name"]
                        }
                    }
                },
                required: ["text", "type", "ingredients"]
            }
        },
        category: { type: SchemaType.STRING },
        servings: { type: SchemaType.NUMBER },
        prepTime: { type: SchemaType.STRING },
        cookTime: { type: SchemaType.STRING },
        cookingMethod: { type: SchemaType.STRING },
        ovenTemp: { type: SchemaType.STRING },
        airFryTemp: { type: SchemaType.STRING }
    },
    required: ["title", "image", "ingredients", "instructions", "category", "servings", "prepTime", "cookTime", "cookingMethod", "ovenTemp", "airFryTemp"]
};

export const getJsonModel = (temperature?: number, schema?: Schema) => {
    return genAI.getGenerativeModel({
        model: PARSING_MODEL,
        safetySettings,
        generationConfig: {
            responseMimeType: "application/json",
            ...(schema ? { responseSchema: schema } : {}),
            ...(temperature !== undefined ? { temperature } : {}),
        }
    });
};

/**
 * Creates a Gemini model for plain text generation.
 */
export const getTextModel = () => {
    return genAI.getGenerativeModel({
        model: PARSING_MODEL,
        safetySettings,
    });
};

/**
 * Cleans markdown wrapper from AI response text.
 */
export const cleanJsonResponse = (text: string): string => {
    if (text.trim().startsWith('```')) {
        return text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    }
    return text;
};
