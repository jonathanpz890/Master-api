import { Router } from 'express';
import { 
  getPopularModels, 
  searchModels, 
  getModelFiles, 
  downloadModelFile,
  getModelImages
} from '../controllers/models.controller';

const router = Router();

// Routes for models proxy and catalog explorer
router.get('/popular', getPopularModels);
router.get('/search', searchModels);
router.get('/files/:id', getModelFiles);
router.get('/images/:id', getModelImages);
router.get('/download', downloadModelFile);

export default router;
