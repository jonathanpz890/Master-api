import { Router } from 'express';
import { sliceModelController } from '../controllers/slicer.controller';
import { upload } from '../middleware/upload.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Route to slice an STL file
// Expects multipart/form-data with key 'file' containing the STL,
// and optional fields 'material', 'infill', and 'layerHeight'
const sliceLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many slicing requests. Try again later.' } });
router.post('/slice', sliceLimiter, upload.single('file'), sliceModelController);

export default router;
