import axios from 'axios';
import { logger } from '../logger.js';
import {
  getJsonModel,
  getTextModel,
  cleanJsonResponse,
  RECIPE_RESPONSE_SCHEMA,
} from '../utils/geminiClient.js';
import { downloadImage, generateImageWithGemini } from '../utils/imageUtils.js';
import {
  buildParseFromTextPrompt,
  buildParseFromImagePrompt,
  buildCreateFromPromptPrompt,
  buildRecipeConceptsPrompt,
} from '../utils/recipePrompts.js';
import { buildCreateListFromPrompt, buildGenerateEntriesFromPrompt } from '../utils/listPrompts.js';
import { buildNoteTextPrompt, buildNoteImagePrompt } from '../utils/notePrompts.js';

const SOURCE_LANGUAGE_SCRIPTS = [
  { label: 'Hebrew', pattern: /[\u0590-\u05FF]/ },
  { label: 'Arabic', pattern: /[\u0600-\u06FF]/ },
  { label: 'Russian', pattern: /[\u0400-\u04FF]/ },
  { label: 'Greek', pattern: /[\u0370-\u03FF]/ },
  { label: 'Japanese', pattern: /[\u3040-\u30FF\u4E00-\u9FFF]/ },
  { label: 'Korean', pattern: /[\uAC00-\uD7AF]/ },
];

const detectSourceLanguage = (text: string): string | undefined =>
  SOURCE_LANGUAGE_SCRIPTS.find(({ pattern }) => pattern.test(text))?.label;

const normalizeSourceLanguage = (value: unknown): string | undefined => {
  const language = String(value || '').trim().toLowerCase();
  if (language.startsWith('he') || language.includes('hebrew')) return 'Hebrew';
  if (language.startsWith('ar') || language.includes('arabic')) return 'Arabic';
  if (language.startsWith('ru') || language.includes('russian')) return 'Russian';
  if (language.startsWith('el') || language.includes('greek')) return 'Greek';
  if (language.startsWith('ja') || language.includes('japanese')) return 'Japanese';
  if (language.startsWith('ko') || language.includes('korean')) return 'Korean';
  return undefined;
};

const recipeUsesSourceScript = (recipe: any, sourceLanguage?: string): boolean => {
  const expectedScript = SOURCE_LANGUAGE_SCRIPTS.find(({ label }) => label === sourceLanguage)?.pattern;
  if (!expectedScript) return true;

  const displayedRecipeText = [
    recipe?.title,
    ...(recipe?.ingredients || []).map((item: any) => item?.ingredient?.name),
    ...(recipe?.instructions || []).map((step: any) => step?.text),
  ]
    .filter(Boolean)
    .join(' ');

  return expectedScript.test(displayedRecipeText);
};

const aiErrorDetails = (error: unknown) => {
  const candidate = error as {
    code?: unknown;
    status?: unknown;
    statusCode?: unknown;
    response?: { data?: { error?: { code?: unknown; message?: unknown } }; status?: unknown };
  };
  const upstreamError = candidate?.response?.data?.error;

  return {
    name: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    status: candidate?.status ?? candidate?.statusCode ?? candidate?.response?.status,
    code: candidate?.code ?? upstreamError?.code,
    upstreamMessage: typeof upstreamError?.message === 'string' ? upstreamError.message : undefined,
  };
};

const isSpoonacularVideoUrl = (url: string) => {
  const parsedUrl = new URL(url);
  const videoHosts = [
    'youtube.com',
    'youtu.be',
    'instagram.com',
    'tiktok.com',
    'facebook.com',
    'pinterest.com',
  ];

  return videoHosts.some(
    (host) => parsedUrl.hostname === host || parsedUrl.hostname.endsWith(`.${host}`),
  );
};

const spoonacularIngredientImageUrl = (image: unknown): string | undefined => {
  if (typeof image !== 'string' || !image.trim()) return undefined;
  if (/^https?:\/\//i.test(image)) return image;

  return `https://img.spoonacular.com/ingredients_100x100/${encodeURIComponent(image)}`;
};

const getYouTubeVideoTitle = async (url: string): Promise<string | undefined> => {
  try {
    const parsedUrl = new URL(url);
    const videoId = parsedUrl.hostname.endsWith('youtu.be')
      ? parsedUrl.pathname.split('/').filter(Boolean)[0]
      : parsedUrl.pathname.match(/^\/shorts\/([^/?#]+)/)?.[1] || parsedUrl.searchParams.get('v');

    if (!videoId) return undefined;

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await axios.get('https://www.youtube.com/oembed', {
      params: { url: canonicalUrl, format: 'json' },
      timeout: 5_000,
    });
    const title = response.data?.title;
    return typeof title === 'string' && title.trim() ? title.trim() : undefined;
  } catch {
    return undefined;
  }
};

type RecipeExtractionResult = {
  recipe: any | null;
  sourceTitle?: string;
};

export const extractRecipeFromUrl = async (url: string): Promise<RecipeExtractionResult> => {
  const parsedUrl = new URL(url);
  const isVideoRecipe = isSpoonacularVideoUrl(url);

  try {
    // Video extraction previously returned title-only data. A forced extraction is the
    // documented retry mechanism for incomplete source data, and avoids making a
    // second 50-point video request just to discover that the result is incomplete.
    const forceExtraction = isVideoRecipe;
    const params = new URLSearchParams({
      apiKey: process.env.BYNDER_SPOONCULAR_API_KEY!,
      url,
      // Spoonacular performs video extraction for supported YouTube, Instagram,
      // TikTok, Facebook Reel, and Pinterest links when this is true.
      extractFromVideo: isVideoRecipe ? 'true' : 'false',
      forceExtraction: String(forceExtraction),
      analyze: 'false',
      includeNutrition: 'false',
      includeTaste: 'false',
    });

    logger.info('Requesting Spoonacular recipe extraction', {
      inputType: isVideoRecipe ? 'video' : 'website',
      host: parsedUrl.hostname,
      extractFromVideo: isVideoRecipe,
      forceExtraction,
    });

    const res = await axios.get(
      `${process.env.BYNDER_SPOONCULAR_API_URL}/recipes/extract?${params.toString()}`,
      { timeout: isVideoRecipe ? 40_000 : 15_000 },
    );
    const data = res.data;

    if (!data?.title) return { recipe: null };

    // Map Spoonacular data to our format.
    const mappedRecipe = {
      title: data.title,
      image: data.image,
      servings: data.servings,
      prepTime: data.readyInMinutes ? `${data.readyInMinutes}m` : '',
      ingredients: (data.extendedIngredients || []).map((ing: any) => ({
        ingredient: {
          name: ing.nameClean || ing.name,
          image: spoonacularIngredientImageUrl(ing.image),
        },
        amount: ing.amount,
        unit: ing.unit,
      })),
      instructions: (data.analyzedInstructions?.[0]?.steps || []).map((step: any) => ({
        text: step.step,
        type: 'step',
        ingredients: (step.ingredients || []).map((si: any) => ({
          name: si.name,
          image: si.image,
        })),
      })),
      sourceUrl: data.sourceUrl || url,
    };

    logger.info('Mapped Spoonacular recipe ingredient images', {
      host: parsedUrl.hostname,
      ingredientCount: mappedRecipe.ingredients.length,
      ingredientImageCount: mappedRecipe.ingredients.filter((item: any) => item.ingredient.image)
        .length,
    });

    const isComplete = mappedRecipe.ingredients.length > 0 && mappedRecipe.instructions.length > 0;
    if (isComplete) {
      return {
        recipe: await finalizeRecipeData(mappedRecipe),
        sourceTitle: data.title,
      };
    }

    logger.warn('Spoonacular returned an incomplete recipe; rejecting extraction', {
      inputType: isVideoRecipe ? 'video' : 'website',
      host: parsedUrl.hostname,
      forceExtraction,
      ingredientCount: mappedRecipe.ingredients.length,
      instructionCount: mappedRecipe.instructions.length,
    });
  } catch (e) {
    logger.warn('Spoonacular extraction failed; falling back to AI parsing', e);
  }
  return { recipe: null };
};

export const parseRecipeFromInput = async (input: string) => {
  let contentToParse = input;
  let originalUrl = '';
  let sourceLanguageHint = detectSourceLanguage(input);

  // Basic URL detection
  const urlPattern = /^(https?:\/\/[^\s]+)$/;
  let htmlImageHint = '';
  let prepTimeHint = '';
  let cookTimeHint = '';
  let servingsHint = '';
  let contextClues = '';

  if (urlPattern.test(input.trim())) {
    originalUrl = input.trim();
    const isVideoRecipe = isSpoonacularVideoUrl(originalUrl);

    // Use Spoonacular's dedicated video extractor before fetching page HTML. YouTube
    // pages do not contain the recipe in their static markup, but this endpoint can
    // return a full recipe for supported cooking videos.
    if (isVideoRecipe) {
      const extraction = await extractRecipeFromUrl(originalUrl);
      if (extraction.recipe) return extraction.recipe;

      const videoTitle = (
        extraction.sourceTitle || (await getYouTubeVideoTitle(originalUrl))
      )
        ?.trim()
        .slice(0, 90);
      const videoLabel = videoTitle ? ` \u201c${videoTitle}\u201d` : '';

      logger.warn('Video recipe extraction produced no complete Spoonacular recipe', {
        host: new URL(originalUrl).hostname,
        videoTitle,
      });
      throw Object.assign(
        new Error(
          videoTitle
            ? `Couldn’t extract a recipe from${videoLabel}.`
            : 'Couldn’t extract a recipe from this video.',
        ),
        { status: 422, code: 'VIDEO_RECIPE_EXTRACTION_INCOMPLETE' },
      );
    }

    try {
      const response = await axios.get(originalUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
          Referer: 'https://www.google.com/',
        },
        timeout: 5000,
      });
      const html = response.data;
      sourceLanguageHint =
        normalizeSourceLanguage(html.match(/<html[^>]+\blang=["']([^"']+)/i)?.[1]) ||
        detectSourceLanguage(html) ||
        sourceLanguageHint;

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

        const ldMatches = html.match(
          /<script type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi,
        );
        if (ldMatches) {
          for (const match of ldMatches) {
            try {
              const content = match.replace(/<script[^>]*>|<\/script>/gi, '').trim();
              const data = JSON.parse(content);
              const items = Array.isArray(data) ? data : data['@graph'] || [data];

              items.forEach((item: any) => {
                if (
                  item['@type'] &&
                  (item['@type'].includes('Recipe') || item['@type'].includes('WebPage'))
                ) {
                  const img = item.image;
                  if (typeof img === 'string') addCandidate(img);
                  else if (Array.isArray(img))
                    img.forEach((i: any) => addCandidate(typeof i === 'string' ? i : i.url));
                  else if (typeof img === 'object' && img.url) addCandidate(img.url);

                if (item['@type'].includes('Recipe')) {
                  if (!sourceLanguageHint && item.inLanguage) {
                    sourceLanguageHint = normalizeSourceLanguage(
                      Array.isArray(item.inLanguage) ? item.inLanguage[0] : item.inLanguage,
                    );
                  }
                  if (item.prepTime) prepTimeHint = convertISODuration(item.prepTime);
                    if (item.cookTime) cookTimeHint = convertISODuration(item.cookTime);
                    if (item.recipeYield)
                      servingsHint = Array.isArray(item.recipeYield)
                        ? String(item.recipeYield[0])
                        : String(item.recipeYield);
                  }
                }
              });
            } catch (e) {
              // JSON-LD parse error — continue without structured hints
            }
          }
        }

        const ogRegex =
          /<meta[^>]+(?:property|name)=["'](?:og|twitter):image["'][^>]+content=["']([^"']+)["']/gi;
        let ogMatch;
        while ((ogMatch = ogRegex.exec(html)) !== null) {
          addCandidate(ogMatch[1]);
        }

        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi;
        let imgMatch;
        let count = 0;
        while ((imgMatch = imgRegex.exec(html)) !== null && count < 10) {
          const src = imgMatch[1];
          if (
            src.includes('avatar') ||
            src.includes('gravatar') ||
            src.includes('logo') ||
            src.endsWith('.svg')
          )
            continue;
          addCandidate(src);
          count++;
        }

        return candidates;
      };

      const imageCandidates = findImageCandidates();
      htmlImageHint = imageCandidates.join(' | ');
      const timeContextMatches = html.match(
        /(?:prep|cook|bake|preparation|cooking|הכנה|בישול|אפייה)[^<]{0,50}\d+[^<]{0,20}(?:min|hour|m|h|דקה|שעה)/gi,
      );
      contextClues = timeContextMatches ? timeContextMatches.slice(0, 5).join(' | ') : '';

      contentToParse = html
        .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
        .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
        .replace(/<nav\b[^>]*>([\s\S]*?)<\/nav>/gi, '')
        .replace(/<footer\b[^>]*>([\s\S]*?)<\/footer>/gi, '')
        .replace(
          /<img[^>]+src=["']([^"']+)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi,
          '\n[IMAGE: $1 (ALT: $2)]\n',
        )
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 30000);
    } catch (error) {
      logger.error('Fetching URL content for AI parsing failed', error);
    }
  }

  let stage = 'create Gemini model';
  try {
    const model = getJsonModel(undefined, RECIPE_RESPONSE_SCHEMA);
    stage = 'generate Gemini content';
    const prompt = buildParseFromTextPrompt(contentToParse, htmlImageHint, sourceLanguageHint);
    const result = await model.generateContent(prompt);
    stage = 'read Gemini response';
    const text = cleanJsonResponse(result.response.text());
    stage = 'parse Gemini JSON response';
    let parsedJson = JSON.parse(text);

    if (!recipeUsesSourceScript(parsedJson, sourceLanguageHint)) {
      logger.warn('AI response did not preserve the source language; retrying extraction', {
        sourceLanguage: sourceLanguageHint,
      });
      const retry = await model.generateContent(`${prompt}\n\nFINAL REQUIREMENT: Your previous response translated the recipe. Return the complete recipe again using ${sourceLanguageHint} script for every displayed title, ingredient name, heading, and instruction. imageSearchName is the only allowed English field.`);
      parsedJson = JSON.parse(cleanJsonResponse(retry.response.text()));

      if (!recipeUsesSourceScript(parsedJson, sourceLanguageHint)) {
        throw new Error(`AI did not preserve the ${sourceLanguageHint} source language`);
      }
    }

    if (!parsedJson.image && htmlImageHint) {
      parsedJson.image = htmlImageHint.split(' | ')[0];
    }

    if (
      parsedJson.image &&
      typeof parsedJson.image === 'string' &&
      parsedJson.image.startsWith('http')
    ) {
      try {
        parsedJson.image = await downloadImage(parsedJson.image);
      } catch (e) {
        logger.warn('Localising recipe image failed', e);
      }
    }

    stage = 'finalize parsed recipe';
    return await finalizeRecipeData(parsedJson);
  } catch (error) {
    logger.error('AI recipe parsing failed', {
      stage,
      inputType: originalUrl ? 'url' : 'text',
      error: aiErrorDetails(error),
    });
    const parseError = new Error('Failed to parse recipe with AI');
    const status = aiErrorDetails(error).status;
    if (typeof status === 'number') Object.assign(parseError, { status });
    throw parseError;
  }
};

const finalizeRecipeData = async (parsedJson: any) => {
  let enrichedIngredients = parsedJson.ingredients || [];
  try {
    const ingredientStrings = (parsedJson.ingredients || [])
      .map(
        (ing: any) =>
          `${ing.amount} ${ing.unit} ${ing.ingredient?.imageSearchName || ing.ingredient?.name}`,
      )
      .join('\n');

    if (ingredientStrings) {
      const spRes = await axios.post(
        `${process.env.BYNDER_SPOONCULAR_API_URL}/recipes/parseIngredients?apiKey=${process.env.BYNDER_SPOONCULAR_API_KEY}`,
        new URLSearchParams({
          ingredientList: ingredientStrings,
          servings: (parsedJson.servings || 1).toString(),
          includeNutrition: 'false',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      if (Array.isArray(spRes.data)) {
        enrichedIngredients = (parsedJson.ingredients || []).map((ing: any, index: number) => {
          const spIng = spRes.data[index];
          const { imageSearchName: _imageSearchName, ...ingredient } = ing.ingredient || {};
          if (spIng) {
            return {
              ...ing,
              ingredient: {
                ...ingredient,
                id: spIng.id,
                image: spoonacularIngredientImageUrl(spIng.image) || ingredient.image,
              },
            };
          }
          return { ...ing, ingredient };
        });
      }
    }
  } catch (e) {
    logger.warn('Batch ingredient enrichment failed', e);
  }

  // imageSearchName is private lookup metadata. Never return or save it as
  // recipe text—the visible ingredient name must remain in the source language.
  enrichedIngredients = enrichedIngredients.map((ing: any) => {
    const { imageSearchName: _imageSearchName, ...ingredient } = ing.ingredient || {};
    return { ...ing, ingredient };
  });

  const enrichedInstructions = (parsedJson.instructions || []).map((step: any) => {
    if (step.type === 'section') return step;

    const stepIngredients = step.ingredients || [];
    const stepTextLower = (step.text || '').toLowerCase();
    const existingNames = new Set(stepIngredients.map((si: any) => si.name?.toLowerCase()));

    const autoDetected: any[] = [];
    enrichedIngredients.forEach((mainIng: any) => {
      const name = mainIng.ingredient?.name?.toLowerCase();
      if (name && stepTextLower.includes(name) && !existingNames.has(name)) {
        autoDetected.push({ name: mainIng.ingredient.name });
      }
    });

    const finalStepIngredients = [...stepIngredients, ...autoDetected].map((stepIng: any) => {
      const searchName = stepIng.name?.toLowerCase() || '';
      const match = enrichedIngredients.find(
        (m: any) =>
          m.ingredient.name.toLowerCase() === searchName ||
          searchName.includes(m.ingredient.name.toLowerCase()) ||
          m.ingredient.name.toLowerCase().includes(searchName),
      );

      if (match) {
        return {
          ingredient: {
            name: match.ingredient.name,
            image: match.ingredient.image,
            id: match.ingredient.id,
          },
          amount: match.amount,
          unit: match.unit,
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
    _id: 'preview',
  };
};

export const parseRecipeFromImage = async (imageBuffer: Buffer, mimeType: string) => {
  let stage = 'create Gemini model';
  try {
    const model = getJsonModel(undefined, RECIPE_RESPONSE_SCHEMA);
    const prompt = buildParseFromImagePrompt();
    stage = 'generate Gemini content';
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: imageBuffer.toString('base64'), mimeType: mimeType } },
    ]);
    stage = 'read Gemini response';
    const text = cleanJsonResponse(result.response.text());
    stage = 'parse Gemini JSON response';
    const parsedJson = JSON.parse(text);
    stage = 'finalize parsed recipe';
    return await finalizeRecipeData(parsedJson);
  } catch (error) {
    logger.error('AI image parsing failed', {
      stage,
      mimeType,
      error: aiErrorDetails(error),
    });
    const parseError = new Error('Failed to parse recipe from image with AI');
    const status = aiErrorDetails(error).status;
    if (typeof status === 'number') Object.assign(parseError, { status });
    throw parseError;
  }
};

export const generateRecipeImage = async (title: string, ingredients: any[]) => {
  const ingredientList = ingredients
    .map((ing) => (typeof ing === 'string' ? ing : ing.ingredient?.name || ing.name))
    .join(', ');
  const prompt = `Generate a professional high-end cookbook photograph for a dish called "${title}".
Key ingredients: ${ingredientList}.
Style: Sharp focus, beautiful natural side-lighting, elegant plating, warm atmospheric background. 
Focus only on the dish itself. Orientation: 16:9 Landscape.`;

  try {
    return await generateImageWithGemini(prompt, 0.4);
  } catch (error: any) {
    logger.error('Native image generation failed', error);
    throw new Error('Failed to generate recipe image with Gemini');
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
    throw new Error('Failed to create recipe with AI');
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
    throw new Error('Failed to brainstorm concepts with AI');
  }
};

export const generateNoteText = async (promptText: string) => {
  const model = getTextModel();
  const prompt = buildNoteTextPrompt(promptText);

  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    throw new Error('Failed to generate text with AI');
  }
};

export const generateNoteImage = async (promptText: string) => {
  try {
    const prompt = buildNoteImagePrompt(promptText);
    return await generateImageWithGemini(prompt, 0.7);
  } catch (error: any) {
    throw new Error('Failed to generate image with AI');
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
    throw new Error('Failed to generate list with AI: ' + error.message);
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
    throw new Error('Failed to generate items with AI: ' + error.message);
  }
};
