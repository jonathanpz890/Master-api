/**
 * Prompt for generating the text content of a note.
 */
export const buildNoteTextPrompt = (userInput: string): string => `
    You are a helpful assistant. The user wants you to generate content for a note.
    User request: "${userInput}"
    
    CRITICAL: Return ONLY the generated text. Do not include any meta-talk, markdown code blocks (unless the user specifically asked for code), or surrounding quotes.
    `;

/**
 * Prompt for generating an image description for a note.
 */
export const buildNoteImagePrompt = (userInput: string): string => 
    `Generate a high-quality image for a note based on this description: ${userInput}. The style should be professional and visually appealing.`;
