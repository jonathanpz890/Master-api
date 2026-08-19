import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure persistent uploads directory exists
const uploadDir =
  process.env.BLUEPRINT_IMAGES_DIR ?? path.resolve(process.cwd(), 'data/print3d-hub/images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedTypes: Record<string, string[]> = {
      '.png': ['image/png'],
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.webp': ['image/webp'],
      '.gif': ['image/gif'],
    };
    if (!allowedTypes[ext]?.includes(file.mimetype)) {
      return cb(new Error('Only image files (png, jpg, jpeg, webp, gif) are allowed.'));
    }
    cb(null, true);
  },
});
