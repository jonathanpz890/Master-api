import axios from 'axios';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { IMAGE_MODEL } from './geminiClient.js';

const IMAGES_DIR = path.resolve(process.cwd(), 'images');

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
        console.log(`[AI-IMPORT] Attempting to download: ${url}`);
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Referer': new URL(url).origin
            },
            timeout: 10000
        });

        const contentType = response.headers['content-type'];
        const extension = contentType?.split('/')[1]?.split(';')[0] || 'jpg';
        const filename = `ai-import-${Date.now()}-${Math.floor(Math.random() * 1000)}.${extension}`;

        return saveImageToDisk(Buffer.from(response.data), filename);
    } catch (error: any) {
        console.error(`[AI-IMPORT] Failed to download image from ${url}:`, error.message);
        return url; // Fallback to original URL
    }
};

/**
 * Saves a buffer to the images directory and returns the public URL.
 */
export const saveImageToDisk = (buffer: Buffer, filename: string): string => {
    const filePath = path.join(IMAGES_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    const localUrl = `${process.env.SERVER_URL}/images/${filename}`;
    console.log(`[IMAGE] Saved: ${localUrl}`);
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
export const generateImageWithGemini = async (prompt: string, temperature: number = 0.4): Promise<string> => {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent?key=${apiKey}`;

    const makeRequest = async (useSnakeCase: boolean) => {
        const modalitiesKey = useSnakeCase ? 'response_modalities' : 'responseModalities';
        const response = await axios.post(url, {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                [modalitiesKey]: ["IMAGE"],
                maxOutputTokens: 2048,
                temperature
            }
        });
        return response.data;
    };

    const extractImage = (data: any): string => {
        if (!data.candidates?.[0]?.content?.parts) {
            throw new Error("Invalid response from Gemini REST API");
        }

        const imagePart = data.candidates[0].content.parts.find((p: any) => p.inlineData);
        if (!imagePart?.inlineData) {
            throw new Error("No image data returned from model");
        }

        return saveBase64Image(
            imagePart.inlineData.data,
            'ai-gen',
            imagePart.inlineData.mimeType
        );
    };

    try {
        // Try snake_case first (v1beta REST spec)
        const data = await makeRequest(true);
        return extractImage(data);
    } catch (error: any) {
        // If response_modalities fails, try camelCase fallback
        if (error.response?.data && JSON.stringify(error.response.data).includes("response_modalities")) {
            console.log("[AI-IMAGE] response_modalities failed, trying responseModalities (camelCase)...");
            try {
                const data = await makeRequest(false);
                return extractImage(data);
            } catch (e2: any) {
                console.error("[AI-IMAGE] CamelCase also failed:", e2.message);
            }
        }
        console.error("[AI-IMAGE] Image generation failed:", error.response?.data || error.message);
        throw new Error("Failed to generate image with Gemini");
    }
};

/**
 * Optimizes an uploaded image buffer using sharp and saves it to the images directory.
 * Returns the public URL.
 */
export const processAndSaveUploadedImage = async (buffer: Buffer, prefix: string = 'item'): Promise<string> => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const fileName = `${prefix}-${uniqueSuffix}.jpg`;
    const filePath = path.join(IMAGES_DIR, fileName);

    await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toFile(filePath);

    return `${process.env.SERVER_URL}/images/${fileName}`;
};

export { IMAGES_DIR };
