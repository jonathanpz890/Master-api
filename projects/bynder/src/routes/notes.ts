import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { createNote, deleteNote, getNotes, updateNote, uploadNoteImage, uploadNoteDoodle } from '../services/NoteServices.js';

const storage = multer.diskStorage({
    destination: (req: any, file: any, cb: any) => {
        cb(null, path.join(__dirname, '../../images'));
    },
    filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
};

const fileUpload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: imageFilter,
});
const notesRouter = express.Router();

notesRouter.get('/', getNotes);
notesRouter.post('/', createNote);
notesRouter.put('/:noteId', updateNote);
notesRouter.delete('/:noteId', deleteNote);
notesRouter.post('/:noteId/images', fileUpload.single('file'), uploadNoteImage);
notesRouter.post('/:noteId/doodle', fileUpload.single('file'), uploadNoteDoodle);

export default notesRouter;
