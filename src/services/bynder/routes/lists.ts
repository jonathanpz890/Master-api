import express from 'express';
import multer from 'multer';
import { clearListEntryImage, createList, createListEntry, deleteList, deleteListEntry, getListById, getLists, updateList, updateListEntry, updateListEntryWithFile, uploadListEntryFile } from '../services/ListServices.js';

const imageFilter = (req: any, file: any, cb: any) => {
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
};

const memoryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: imageFilter,
});
const listRouter = express.Router();

// Example route
listRouter.get('/', getLists)
listRouter.get('/:listId', getListById)
listRouter.put('/:listId', updateList)
listRouter.delete('/:listId', deleteList)
listRouter.post('/', createList)
listRouter.post('/:listId', createListEntry)
listRouter.delete('/:listId/entry/:entryId', deleteListEntry)
listRouter.put('/:listId/entry/:entryId', updateListEntry)
listRouter.put('/:listId/entry/:entryId/file', memoryUpload.single('file'), updateListEntryWithFile)
listRouter.post('/:listId/entry/:entryId/files', memoryUpload.single('file'), uploadListEntryFile)
listRouter.put('/:listId/entry/:entryId/clear_image', clearListEntryImage)


export default listRouter;