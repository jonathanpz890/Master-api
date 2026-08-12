import { Request, Response } from "express";
import { Note } from "../db/models/Note.model.js";

export const getNotes = async (req: Request, res: Response) => {
    try {
        const userId = (req.user as any)._id;
        const { projectId } = req.query;
        const query: any = { userId };
        if (projectId) query.projectId = projectId;

        const notes = await Note.find(query).sort({ pinned: -1, updatedAt: -1 });

        res.status(200).json({ notes });
    } catch (error: any) {
        console.error("Error fetching notes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const createNote = async (req: Request, res: Response) => {
    try {
        const { title, content, color, tags, projectId } = req.body;
        const userId = (req.user as any)._id;

        const newNote = await Note.create({
            userId,
            projectId: projectId || null,
            title: title || 'Untitled Note',
            content: content || '',
            color: color || '#ffffff',
            tags: tags || []
        });

        res.status(200).json({ note: newNote });
    } catch (error: any) {
        console.error("Error creating note:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const updateNote = async (req: Request, res: Response) => {
    try {
        const { noteId } = req.params;
        const { update } = req.body;
        const userId = (req.user as any)._id;

        // Sanitize images if they exist in the update
        if (update && update.images && Array.isArray(update.images)) {
            update.images = update.images.map((img: any) => {
                const newImg = { ...img };
                // If it's a temporary ID (like AI generated), remove it so Mongoose generates a real one
                if (newImg._id && typeof newImg._id === 'string' && !/^[0-9a-fA-F]{24}$/.test(newImg._id)) {
                    delete newImg._id;
                }
                return newImg;
            });
        }

        const note = await Note.findOneAndUpdate(
            { _id: noteId, userId },
            { $set: update },
            { new: true }
        );

        if (!note) {
            res.status(404).json({ message: 'Note not found' });
            return;
        }

        res.status(200).json({ note });
    } catch (error: any) {
        console.error("Error updating note:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const deleteNote = async (req: Request, res: Response) => {
    try {
        const { noteId } = req.params;
        const userId = (req.user as any)._id;

        const note = await Note.findOneAndDelete({ _id: noteId, userId });

        if (!note) {
            res.status(404).json({ message: 'Note not found' });
            return;
        }

        res.status(200).json({ message: 'Note deleted successfully', noteId });
    } catch (error: any) {
        console.error("Error deleting note:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const uploadNoteImage = async (req: Request, res: Response) => {
    try {
        const { noteId } = req.params;
        const file = req.file;
        const userId = (req.user as any)._id;

        if (!file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        const imageUrl = `${process.env.SERVER_URL}/images/${file.filename}`;
        const { x, y, width, height, rotation } = req.body;

        const newImage = {
            url: imageUrl,
            caption: file.originalname,
            x: x !== undefined ? Number(x) : 50,
            y: y !== undefined ? Number(y) : 50,
            width: width !== undefined ? Number(width) : 200,
            height: height !== undefined ? Number(height) : 200,
            rotation: rotation !== undefined ? Number(rotation) : 0
        };

        const updatedNote = await Note.findOneAndUpdate(
            { _id: noteId, userId },
            { $push: { images: newImage as any } },
            { new: true }
        );

        res.status(200).json({ note: updatedNote });
    } catch (error: any) {
        console.error("Error uploading note image:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const uploadNoteDoodle = async (req: Request, res: Response) => {
    try {
        const { noteId } = req.params;
        const file = req.file;
        const userId = (req.user as any)._id;

        if (!file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        const doodleUrl = `${process.env.SERVER_URL}/images/${file.filename}`;

        const updatedNote = await Note.findOneAndUpdate(
            { _id: noteId, userId },
            { $set: { doodle: doodleUrl } },
            { new: true }
        );

        if (!updatedNote) {
            res.status(404).json({ message: 'Note not found' });
            return;
        }

        res.status(200).json({ note: updatedNote });
    } catch (error: any) {
        console.error("Error uploading note doodle:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

