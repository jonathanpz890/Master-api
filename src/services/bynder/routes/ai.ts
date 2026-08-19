import express from 'express';
import { generateNoteText, generateNoteImage, generateListFromPrompt, generateListEntriesFromPrompt } from '../services/aiService.js';

const aiRouter = express.Router();

aiRouter.post('/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;
        const text = await generateNoteText(prompt);
        res.json({ text });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

aiRouter.post('/generate-image', async (req, res) => {
    try {
        const { prompt } = req.body;
        const imageUrl = await generateNoteImage(prompt);
        res.json({ imageUrl });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

aiRouter.post('/generate-list', async (req, res) => {
    try {
        const { prompt } = req.body;
        const listData = await generateListFromPrompt(prompt);
        res.json({ listData });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

aiRouter.post('/generate-list-items', async (req, res) => {
    try {
        const { prompt, listContext } = req.body;
        const result = await generateListEntriesFromPrompt(prompt, listContext);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default aiRouter;
