import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { IMAGE_FALLBACK_MODEL, IMAGE_MODEL } from './geminiClient.js';
import { logger } from '../logger.js';

const IMAGES_DIR =
  process.env.BYNDER_IMAGES_DIR ?? path.resolve(process.cwd(), 'data/bynder/images');

// Ensure images directory exists on module load
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

/**
 * Downloads an image from a URL and saves it locally.
 * Returns the local URL. Falls back to the original URL on failure.
 */
export const downloadImage = async (url: string): Promise<string> => {
  try {
    logger.info('Downloading image for AI import');
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Referer: new URL(url).origin,
      },
      timeout: 10000,
    });

    const contentType = response.headers['content-type'];
    const extension = contentType?.split('/')[1]?.split(';')[0] || 'jpg';
    const filename = `ai-import-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;

    return saveImageToDisk(Buffer.from(response.data), filename);
  } catch (error: any) {
    logger.error('AI image import download failed', error);
    return url; // Fallback to original URL
  }
};

/**
 * Saves a buffer to the images directory and returns the public URL.
 */
export const saveImageToDisk = (buffer: Buffer, filename: string): string => {
  const filePath = path.join(IMAGES_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  const localUrl = `${process.env.BYNDER_SERVER_URL}/images/${filename}`;
  logger.info('Image saved locally');
  return localUrl;
};

/**
 * Saves a base64-encoded image to disk and returns the public URL.
 */
export const saveBase64Image = (base64Data: string, prefix: string, mimeType?: string): string => {
  const extension = mimeType?.split('/')[1] || 'png';
  const filename = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;
  return saveImageToDisk(Buffer.from(base64Data, 'base64'), filename);
};

/**
 * Generates an image using Gemini's image model via REST API.
 * Handles the response_modalities vs responseModalities fallback automatically.
 */
export const generateImageWithGemini = async (
  prompt: string,
  temperature: number = 0.4,
): Promise<string> => {
  const apiKey = process.env.BYNDER_GEMINI_API_KEY;
  const imageModels = [...new Set([IMAGE_MODEL, IMAGE_FALLBACK_MODEL].filter(Boolean))];

  const makeRequest = async (model: string, useSnakeCase: boolean) => {
    const modalitiesKey = useSnakeCase ? 'response_modalities' : 'responseModalities';
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          [modalitiesKey]: ['IMAGE'],
          maxOutputTokens: 2048,
          temperature,
        },
      },
      { headers: { 'x-goog-api-key': apiKey } },
    );
    return response.data;
  };

  const isUnavailableModelError = (error: any): boolean =>
    error?.response?.status === 404 ||
    /model.+(?:not found|no longer available|not available)/i.test(error?.message || '');

  const extractImage = (data: any): string => {
    if (!data.candidates?.[0]?.content?.parts) {
      throw new Error('Invalid response from Gemini REST API');
    }

    const imagePart = data.candidates[0].content.parts.find((p: any) => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error('No image data returned from model');
    }

    return saveBase64Image(imagePart.inlineData.data, 'ai-gen', imagePart.inlineData.mimeType);
  };

  try {
    for (const [index, model] of imageModels.entries()) {
      try {
        // Current Gemini REST API uses camelCase. Retain snake_case for older compatible endpoints.
        const data = await makeRequest(model, false);
        return extractImage(data);
      } catch (error: any) {
        if (isUnavailableModelError(error) && index < imageModels.length - 1) {
          logger.warn('Configured Gemini image model is unavailable; retrying fallback', {
            configuredModel: model,
            fallbackModel: imageModels[index + 1],
          });
          continue;
        }
        if (
          error.response?.data &&
          JSON.stringify(error.response.data).includes('responseModalities')
        ) {
          logger.warn('AI image response modalities retrying with alternate option name');
          const data = await makeRequest(model, true);
          return extractImage(data);
        }
        throw error;
      }
    }
    throw new Error('No Gemini image model is configured');
  } catch (error: any) {
    logger.error('AI image generation failed', error);
    throw new Error('Failed to generate image with Gemini');
  }
};

/**
 * Optimizes an uploaded image buffer using sharp and saves it to the images directory.
 * Returns the public URL.
 */
export const processAndSaveUploadedImage = async (
  buffer: Buffer,
  prefix: string = 'item',
): Promise<string> => {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const fileName = `${prefix}-${uniqueSuffix}.jpg`;
  const filePath = path.join(IMAGES_DIR, fileName);

  await sharp(buffer)
    .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(filePath);

  return `${process.env.BYNDER_SERVER_URL}/images/${fileName}`;
};

export { IMAGES_DIR };
