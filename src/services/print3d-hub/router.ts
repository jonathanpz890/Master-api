import express, { type Router } from 'express';
import fs from 'node:fs';
import mongoose from 'mongoose-print3d';
import { logger } from 'mnemonix';
import path from 'node:path';

import { validateAuthConfiguration } from './controllers/management.controller';
import { DBService } from './services/db.service';
import managementRouter from './routes/management.routes';
import modelsRouter from './routes/models.routes';
import slicerRouter from './routes/slicer.routes';

let initialization: Promise<void> | undefined;

export const initializePrint3dHub = (): Promise<void> => {
  initialization ??= (async () => {
    validateAuthConfiguration();
    await DBService.connectDB();
  })().catch((error: unknown) => {
    logger.error('Print3D Hub service initialization failed', error);
    initialization = undefined;
    throw error;
  });
  return initialization;
};

export const isPrint3dHubConnected = (): boolean => mongoose.connection.readyState === 1;

export const createPrint3dHubRouter = (): Router => {
  const router = express.Router();
  const imagesDirectory =
    process.env.BLUEPRINT_IMAGES_DIR ?? path.resolve(process.cwd(), 'data/print3d-hub/images');
  fs.mkdirSync(imagesDirectory, { recursive: true });
  fs.mkdirSync(
    process.env.BLUEPRINT_UPLOADS_DIR ?? path.resolve(process.cwd(), 'data/print3d-hub/uploads'),
    { recursive: true },
  );
  fs.mkdirSync(
    process.env.BLUEPRINT_TEMP_DIR ?? path.resolve(process.cwd(), 'data/print3d-hub/temp'),
    { recursive: true },
  );

  router.use(express.json({ limit: '1mb' }));
  router.use(express.urlencoded({ extended: true, limit: '1mb' }));
  router.use('/images', express.static(imagesDirectory, { fallthrough: false, maxAge: '1d' }));
  router.use('/api', slicerRouter);
  router.use('/api', managementRouter);
  router.use('/api/models', modelsRouter);
  router.get('/health', (_request, response) => response.status(200).json({ status: 'ok' }));
  logger.info('Print3D Hub service router created');

  return router;
};
