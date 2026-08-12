import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getProjects, getProjectById, createProject, updateProject, deleteProject, uploadProjectFile, deleteProjectFile } from '../services/ProjectServices.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, path.join(__dirname, '../../images'));
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `project-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const fileUpload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const router = express.Router();

router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/', createProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/files', fileUpload.single('file'), uploadProjectFile);
router.delete('/:id/files/:fileId', deleteProjectFile);

export default router;
