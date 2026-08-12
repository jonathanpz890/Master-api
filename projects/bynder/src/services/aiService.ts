import axios from 'axios';
import {
    getJsonModel,
    getTextModel,
    cleanJsonResponse,
    RECIPE_RESPONSE_SCHEMA
} from '../utils/geminiClient.js';
import {
    downloadImage,
    generateImageWithGemini,
} from '../utils/imageUtils.js';
import {
    buildParseFromTextPrompt,
    buildParseFromImagePrompt,
    buildCreateFromPromptPrompt,
    buildRecipeConceptsPrompt
} from '../utils/recipePrompts.js';
import {
    buildCreateListFromPrompt,
    buildGenerateEntriesFromPrompt
} from '../utils/listPrompts.js';
import {
    buildNoteTextPrompt,
    buildNoteImagePrompt
} from '../utils/notePrompts.js';

export const extractRecipeFromUrl = async (url: string) => {
    try {
        const isVideo = url.includes('youtube.com') || 
                        url.includes('youtu.be') || 
                        url.includes('instagram.com/reel') || 
                        url.includes('tiktok.com') || 
                        url.includes('facebook.com/reels');

        const params = new URLSearchParams({
            apiKey: process.env.SPOONCULAR_API_KEY!,
            url,
            forceExtraction: 'true',
            extractFromVideo: isVideo ? 'true' : 'false'
        });

        const res = await axios.get(`${process.env.SPOONCULAR_API_URL}/recipes/extract?${params.toString()}`);
        const data = res.data;

        if (data && data.title) {
            // Map Spoonacular data to our format
            const mappedRecipe = {
                title: data.title,
                image: data.image,
                servings: data.servings,
                prepTime: data.readyInMinutes ? `${data.readyInMinutes}m` : '',
                ingredients: (data.extendedIngredients || []).map((ing: any) => ({
                    ingredient: { name: ing.nameClean || ing.name, image: ing.image },
                    amount: ing.amount,
                    unit: ing.unit
                })),
                instructions: (data.analyzedInstructions?.[0]?.steps || []).map((step: any) => ({
                    text: step.step,
                    type: 'step',
                    ingredients: (step.ingredients || []).map((si: any) => ({ name: si.name, image: si.image }))
                })),
                sourceUrl: data.sourceUrl
            };

            return await finalizeRecipeData(mappedRecipe);
        }
    } catch (e) {
        console.warn("Spoonacular extraction failed, falling back to AI parsing:", e);
    }
    return null;
};

export const parseRecipeFromInput = async (input: string) => {
    let contentToParse = input;
    let originalUrl = '';

    // Basic URL detection
    const urlPattern = /^(https?:\/\/[^\s]+)$/;
    let htmlImageHint = '';
    let prepTimeHint = '';
    let cookTimeHint = '';
    let servingsHint = '';
    let contextClues = '';

    if (urlPattern.test(input.trim())) {
        originalUrl = input.trim();
        
        // Attempt Spoonacular extraction first for URLs
        const extracted = await extractRecipeFromUrl(originalUrl);
        if (extracted) return extracted;

        try {
            const response = await axios.get(originalUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 5000
            });
            const html = response.data;

            const getAbsoluteUrl = (url: string) => {
                if (!url) return '';
                if (url.startsWith('http')) return url;
                try {
                    return new URL(url, originalUrl).href;
                } catch (e) {
                    return url;
                }
            };

            const convertISODuration = (duration: string) => {
                if (!duration || typeof duration !== 'string') return '';
                const match = duration.match(/PT?(?:(\d+)D)?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
                if (!match) return duration;
                let result = '';
                if (match[1]) result += `${match[1]}d `;
                if (match[2]) result += `${match[2]}h `;
                if (match[3]) result += `${match[3]}m`;
                return result.trim() || duration;
            };

            const findImageCandidates = () => {
                const candidates: string[] = [];
                const addCandidate = (url: string) => {
                    const absolute = getAbsoluteUrl(url);
                    if (absolute && !candidates.includes(absolute)) candidates.push(absolute);
                };

                const ldMatches = html.match(/<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi);
                if (ldMatches) {
                    for (const match of ldMatches) {
                        try {
                            const content = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
                            const data = JSON.parse(content);
                            const items = Array.isArray(data) ? data : (data['@graph'] || [data]);

                            items.forEach((item: any) => {
                                if (item['@type'] && (item['@type'].includes('Recipe') || item['@type'].includes('WebPage'))) {
                                    const img = item.image;
                                    if (typeof img === 'string') addCandidate(img);
                                    else if (Array.isArray(img)) img.forEach((i: any) => addCandidate(typeof i === 'string' ? i : i.url));
                                    else if (typeof img === 'object' && img.url) addCandidate(img.url);

                                    if (item['@type'].includes('Recipe')) {
                                        if (item.prepTime) prepTimeHint = convertISODuration(item.prepTime);
                                        if (item.cookTime) cookTimeHint = convertISODuration(item.cookTime);
                                        if (item.recipeYield) servingsHint = Array.isArray(item.recipeYield) ? String(item.recipeYield[0]) : String(item.recipeYield);
                                    }
                                }
                            });
                        } catch (e) {
                            // JSON-LD parse error — continue without structured hints
                        }
                    }
                }

                const ogRegex = /<meta[^>]+(?:property|name)=["'](?:og|twitter):image["'][^>]+content=["']([^"']+)["']/gi;
                let ogMatch;
                while ((ogMatch = ogRegex.exec(html)) !== null) {
                    addCandidate(ogMatch[1]);
                }

                const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi;
                let imgMatch;
                let count = 0;
                while ((imgMatch = imgRegex.exec(html)) !== null && count < 10) {
                    const src = imgMatch[1];
                    if (src.includes('avatar') || src.includes('gravatar') || src.includes('logo') || src.endsWith('.svg')) continue;
                    addCandidate(src);
                    count++;
                }

                return candidates;
            }

            const imageCandidates = findImageCandidates();
            htmlImageHint = imageCandidates.join(' | ');
            const timeContextMatches = html.match(/(?:prep|cook|bake|preparation|cooking|הכנה|בישול|אפייה)[^<]{0,50}\d+[^<]{0,20}(?:min|hour|m|h|דקה|שעה)/gi);
            contextClues = timeContextMatches ? timeContextMatches.slice(0, 5).join(' | ') : '';

            contentToParse = html
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
                .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi, '')
                .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gi, '')
                .replace(/<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '\n[IMAGE: $1 (ALT: $2)]\n')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .slice(0, 30000);
        } catch (error) {
            console.error("Failed to fetch URL content:", error);
        }
    }

    const model = getJsonModel(undefined, RECIPE_RESPONSE_SCHEMA);
    const prompt = buildParseFromTextPrompt(contentToParse, htmlImageHint);

    try {
        const result = await model.generateContent(prompt);
        const text = cleanJsonResponse(result.response.text());
        const parsedJson = JSON.parse(text);

        if (!parsedJson.image && htmlImageHint) {
            parsedJson.image = htmlImageHint.split(' | ')[0];
        }

        if (parsedJson.image && typeof parsedJson.image === 'string' && parsedJson.image.startsWith('http')) {
            try {
                parsedJson.image = await downloadImage(parsedJson.image);
            } catch (e) {
                console.warn("Failed to localise recipe image:", e);
            }
        }

        return finalizeRecipeData(parsedJson);
    } catch (error) {
        console.error("AI Parsing Error:", error);
        throw new Error("Failed to parse recipe with AI");
    }
};

const finalizeRecipeData = async (parsedJson: any) => {
    let enrichedIngredients = parsedJson.ingredients || [];
    try {
        const ingredientStrings = (parsedJson.ingredients || []).map((ing: any) =>
            `${ing.amount} ${ing.unit} ${ing.ingredient?.name}`
        ).join('\n');

        if (ingredientStrings) {
            const spRes = await axios.post(
                `${process.env.SPOONCULAR_API_URL}/recipes/parseIngredients?apiKey=${process.env.SPOONCULAR_API_KEY}`,
                new URLSearchParams({
                    ingredientList: ingredientStrings,
                    servings: (parsedJson.servings || 1).toString(),
                    includeNutrition: 'false'
                }),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            );

            if (Array.isArray(spRes.data)) {
                enrichedIngredients = (parsedJson.ingredients || []).map((ing: any, index: number) => {
                    const spIng = spRes.data[index];
                    if (spIng) {
                        return {
                            ...ing,
                            ingredient: {
                                ...ing.ingredient,
                                id: spIng.id,
                                image: spIng.image
                            }
                        };
                    }
                    return ing;
                });
            }
        }
    } catch (e) {
        console.warn("Failed to batch enrich ingredients:", e);
    }

    const enrichedInstructions = (parsedJson.instructions || []).map((step: any) => {
        if (step.type === 'section') return step;

        const stepIngredients = step.ingredients || [];
        const stepTextLower = (step.text || "").toLowerCase();
        const existingNames = new Set(stepIngredients.map((si: any) => si.name?.toLowerCase()));

        const autoDetected: any[] = [];
        enrichedIngredients.forEach((mainIng: any) => {
            const name = mainIng.ingredient?.name?.toLowerCase();
            if (name && stepTextLower.includes(name) && !existingNames.has(name)) {
                autoDetected.push({ name: mainIng.ingredient.name });
            }
        });

        const finalStepIngredients = [...stepIngredients, ...autoDetected].map((stepIng: any) => {
            const searchName = stepIng.name?.toLowerCase() || "";
            const match = enrichedIngredients.find((m: any) =>
                m.ingredient.name.toLowerCase() === searchName ||
                searchName.includes(m.ingredient.name.toLowerCase()) ||
                m.ingredient.name.toLowerCase().includes(searchName)
            );

            if (match) {
                return {
                    ingredient: {
                        name: match.ingredient.name,
                        image: match.ingredient.image,
                        id: match.ingredient.id
                    },
                    amount: match.amount,
                    unit: match.unit
                };
            }

            return { ingredient: { name: stepIng.name } };
        });

        return { ...step, ingredients: finalStepIngredients };
    });

    return {
        ...parsedJson,
        ingredients: enrichedIngredients,
        instructions: enrichedInstructions,
        _id: 'preview'
    };
};

export const parseRecipeFromImage = async (imageBuffer: Buffer, mimeType: string) => {
    const model = getJsonModel(undefined, RECIPE_RESPONSE_SCHEMA);
    const prompt = buildParseFromImagePrompt();

    try {
        const result = await model.generateContent([
            prompt,
            { inlineData: { data: imageBuffer.toString('base64'), mimeType: mimeType } }
        ]);
        const text = cleanJsonResponse(result.response.text());
        const parsedJson = JSON.parse(text);
        return finalizeRecipeData(parsedJson);
    } catch (error) {
        console.error("AI Image Parsing Error:", error);
        throw new Error("Failed to parse recipe from image with AI");
    }
};

export const generateRecipeImage = async (title: string, ingredients: any[]) => {
    const ingredientList = ingredients.map(ing => (typeof ing === 'string' ? ing : (ing.ingredient?.name || ing.name))).join(', ');
    const prompt = `Generate a professional high-end cookbook photograph for a dish called "${title}".
Key ingredients: ${ingredientList}.
Style: Sharp focus, beautiful natural side-lighting, elegant plating, warm atmospheric background. 
Focus only on the dish itself. Orientation: 16:9 Landscape.`;

    try {
        return await generateImageWithGemini(prompt, 0.4);
    } catch (error: any) {
        console.error("Native Image Generation Error:", error.message || error);
        throw new Error("Failed to generate recipe image with Gemini");
    }
};

export const generateRecipeFromPrompt = async (userInput: string, creativity: number = 50) => {
    const temperature = Math.min(Math.max(creativity / 100, 0), 1);
    const model = getJsonModel(temperature, RECIPE_RESPONSE_SCHEMA);
    const prompt = buildCreateFromPromptPrompt(userInput, creativity);

    try {
        const result = await model.generateContent(prompt);
        const text = cleanJsonResponse(result.response.text());
        const parsedJson = JSON.parse(text);
        const finalized = await finalizeRecipeData(parsedJson);

        let aiImage = '';
        try {
            aiImage = await generateRecipeImage(finalized.title, finalized.ingredients);
        } catch (e) {
            // Image generation failed — return recipe without an image
        }

        return { ...finalized, image: aiImage };
    } catch (error) {
        throw new Error("Failed to create recipe with AI");
    }
};

export const generateRecipeConcepts = async (userInput: string, creativity: number = 50) => {
    const temperature = Math.min(Math.max(creativity / 100, 0), 1);
    const model = getJsonModel(temperature);
    const prompt = buildRecipeConceptsPrompt(userInput, creativity);

    try {
        const result = await model.generateContent(prompt);
        const text = cleanJsonResponse(result.response.text());
        return JSON.parse(text).concepts;
    } catch (error) {
        throw new Error("Failed to brainstorm concepts with AI");
    }
};

export const generateNoteText = async (promptText: string) => {
    const model = getTextModel();
    const prompt = buildNoteTextPrompt(promptText);

    try {
        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        throw new Error("Failed to generate text with AI");
    }
};

export const generateNoteImage = async (promptText: string) => {
    try {
        const prompt = buildNoteImagePrompt(promptText);
        return await generateImageWithGemini(prompt, 0.7);
    } catch (error: any) {
        throw new Error("Failed to generate image with AI");
    }
};

export const generateListFromPrompt = async (userInput: string) => {
    const model = getJsonModel(0.7);
    const prompt = buildCreateListFromPrompt(userInput);

    try {
        const result = await model.generateContent(prompt);
        const text = cleanJsonResponse(result.response.text());
        return JSON.parse(text);
    } catch (error: any) {
        throw new Error("Failed to generate list with AI: " + error.message);
    }
};

export const generateListEntriesFromPrompt = async (userInput: string, listContext: any) => {
    const model = getJsonModel(0.7);
    const prompt = buildGenerateEntriesFromPrompt(userInput, listContext);

    try {
        const result = await model.generateContent(prompt);
        const text = cleanJsonResponse(result.response.text());
        return JSON.parse(text);
    } catch (error: any) {
        throw new Error("Failed to generate items with AI: " + error.message);
    }
};
