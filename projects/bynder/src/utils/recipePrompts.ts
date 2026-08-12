/**
 * Shared recipe JSON schema used across all recipe-related prompts.
 * Eliminates the 3 near-identical schema copies that were in aiService.ts.
 */
export const RECIPE_JSON_SCHEMA = `{
    "title": "Recipe Title",
    "image": "URL of the main recipe photo if found, else empty string",
    "ingredients": [
        {
            "ingredient": { "name": "Ingredient Name" },
            "unit": "unit (g, ml, tbsp, cup, etc.)",
            "amount": "amount (e.g., \\"1\\", \\"0.5\\", \\"200\\")"
        }
    ],
    "instructions": [
        {
            "text": "Step description OR Section Title",
            "type": "step" or "section",
            "ingredients": [
                { "name": "EXACT Name used in the main ingredients list" }
            ]
        }
    ],
    "category": "Dinner, Breakfast, Lunch, Dessert, Snack, Appetizers, Drinks, Quick & Easy, Healthy, Vegetarian, Vegan, Gluten-Free, Other",
    "servings": 4, 
    "prepTime": "e.g., 15m",
    "cookTime": "e.g., 30m",
    "cookingMethod": "Stovetop, Oven/Bake, Air Fryer, Slow Cooker, No-Cook, Other",
    "ovenTemp": "number only (Celsius) or empty string",
    "airFryTemp": "number only (Celsius) or empty string"
}`;

/**
 * Shared fidelity rules used by both parseRecipeFromInput and parseRecipeFromImage.
 */
export const RECIPE_FIDELITY_RULES = `
    CRITICAL FIDELITY RULES:
    1. STRICT MIRRORING: Do NOT "fix" the recipe. Do NOT reorder the instructions. Do NOT change the order of ingredients. Follow the sequence EXACTLY as it appears in the source.
    2. NO GUESSING: If you see "soy milk", do NOT change it to "oil" or "milk" even if you think it's better for the dish. If the user put eggs in step 10, do NOT move them to step 1.
    3. TRANSLATION: If the source is in Hebrew or any other language, translate it faithfully to English. Use the literal culinary translation.
    4. OUTPUT FORMAT: Return ONLY a JSON object matching this schema.
    5. INGREDIENT NAMES: Use simple, singular ingredient names (e.g., "Egg" instead of "3 eggs"). Keep the quantities and hints in the amount/unit fields.
    6. FRACTIONS: Use standard decimal numbers for amounts (e.g., 0.5 instead of 1/2). Round to 3 decimal places if necessary.
    7. STEP LINKING: Link ingredients to the steps ONLY where they are actually mentioned in the text.
    8. STRICT ALTERNATIVES: If the source says "X or Y" (e.g., "Butter or Oil" or "חמאה או שמן"), you MUST treat them as a SINGLE ingredient entry. Set the name to "Ingredient X OR Ingredient Y". Never split them into two separate required ingredients.
    9. HEBREW HANDWRITING (KTAV): Be aware that handwritten Hebrew often uses cursive (Ktav). Search specifically for the 'או' (or) keyword between ingredients to avoid missing alternatives.`;

/**
 * Builds the prompt for parsing a recipe from text/URL content.
 */
export const buildParseFromTextPrompt = (content: string, imageHint: string): string => `
    You are a meticulous Transcription and Translation Specialist. 
    Your task is to accurately extract recipe information from the provided input (text, URL content, or transcription).

    ${RECIPE_FIDELITY_RULES}
    8. IMAGE EXTRACTION: Find the absolute best "Hero" image for the recipe. Look at the HINT provided below first.
    9. SECTIONS: Preserve the original section headers (e.g., "For the Batter", "For the Glaze") exactly.

    SCHEMA:
    ${RECIPE_JSON_SCHEMA}

    INPUT TO PARSE:
    ${content}

    IMAGE CANDIDATES DETECTED:
    ${imageHint || 'None'}
    `;

/**
 * Builds the prompt for parsing a recipe from an image.
 */
export const buildParseFromImagePrompt = (): string => `
    You are a meticulous Transcription and Translation Specialist. 
    Your task is to extract recipe information from the provided IMAGE (could be a photo of a cookbook, a handwritten note, or a screenshot).
    
    ${RECIPE_FIDELITY_RULES}

    TRANSCRIPTION WORKFLOW:
    - First, mentally or internally transcribe the raw text in its original language.
    - Then, translate that transcription to English.
    - Finally, structure it into the JSON schema below.
    
    SCHEMA:
    ${RECIPE_JSON_SCHEMA}
    `;

/**
 * Builds the prompt for AI-generating a recipe from a user's creative request.
 */
export const buildCreateFromPromptPrompt = (userInput: string, creativity: number): string => {
    const creativityInstruction = creativity < 30
        ? "Focus on being extremely accurate and traditional. Stick strictly to the user's intent with simple, foolproof methods."
        : creativity > 70
            ? "Be imaginative and innovative. Think like a top-tier chef creating a signature dish. Introduce interesting twists or flavor combinations while keeping ingredients grounded and high-quality."
            : "Balance classic techniques with modern touches. Make it interesting but ensure it remains a practical, delicious home-cooked meal.";

    return `
    You are a Michelin-star chef and creative recipe developer.
    Your task is to CREATE a brand new, high-quality recipe based on the user's request.

    USER REQUEST: "${userInput}"

    CREATIVITY FOCUS: ${creativityInstruction}

    1. DIETARY COMPLIANCE (CRITICAL): If the user's request mentions a dietary preference (e.g., "Vegan", "Gluten-Free", "Dairy-Free", "Keto", "Halal"), this requirement takes ABSOLUTE PRECEDENCE. The recipe MUST be 100% strictly compliant with that diet (e.g. no eggs/butter/honey in a Vegan recipe). If NO dietary preference is mentioned, do NOT create a dietary version; stick to standard, traditional ingredients.
    2. OUTPUT FORMAT: Return ONLY a JSON object matching the standard schema.
    3. LANGUAGE: Always return the recipe in English.
    4. QUALITY: The recipe should be balanced, appetizing, and correct in its measurements.
    5. IMAGE: Since you are creating this from scratch, do NOT provide an image URL. Set "image" to an empty string. The system will generate one later.
    6. STEP LINKING: Link every ingredient to its corresponding instruction steps.
    7. ACCESSIBILITY: Prioritize common, pantry-staple ingredients that are easy to find. Avoid overly exotic or "weird" ingredients (e.g., unexpected spices in classic bakes) unless specifically requested.
    8. REALISM: Ensure ingredient combinations are culinary sound and realistic.

    SCHEMA:
    ${RECIPE_JSON_SCHEMA}
    `;
};

/**
 * Builds the prompt for brainstorming 4 distinct recipe concepts.
 */
export const buildRecipeConceptsPrompt = (userInput: string, creativity: number): string => {
    const creativityInstruction = creativity < 30
        ? "Focus on being extremely traditional, classic, and reliable. Suggest concepts that are safe, popular, and easy to execute."
        : creativity > 70
            ? "Be imaginative and innovative. Think like a top-tier chef creating a signature dish. Introduce interesting twists or unique flavor combinations that still feel professional and high-quality."
            : "Balance classic techniques with modern touches. Make them interesting but ensure they remain practical, delicious home-cooked meals.";

    return `
    You are a technical chef and recipe strategist.
    Based on the user's request, brainstorm 4 DISTINCT recipe concepts.
    
    USER REQUEST: "${userInput}"

    CREATIVITY FOCUS: ${creativityInstruction}

    1. DIETARY COMPLIANCE (CRITICAL): If the user's request mentions a dietary preference (e.g., "Vegan", "Gluten-Free", "Keto", "Dairy-Free"), EVERY SINGLE ONE of the 4 concepts MUST strictly adhere to that requirement. Absolute compliance is mandatory. If no dietary preference is mentioned, suggest standard, traditional versions and do NOT include unsolicited diet versions.
    2. VARIETY: Ensure the 4 concepts use different primary techniques or flavor profiles (within the dietary constraints if any).
    3. OBJECTIVITY: Descriptions must be purely factual and technical. 
    4. NO MARKETING: Absolutely NO promotional adjectives.
    5. CONTENT: Describe only the core ingredients and the fundamental cooking method. Prioritize realistic and accessible combinations.
    6. LANGUAGE: Always return in English.
    7. OUTPUT FORMAT: Return ONLY a JSON object with this exact structure:
    {
        "concepts": [
            { "title": "Objective Title", "description": "Short, factual technical description" }
        ]
    }
    `;
};
