import { Request, Response } from 'express';
import { Template } from '../db/models/Template.model.js';
import { logger } from '../logger.js';

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const templates = await Template.find();

    if (!templates) {
      res.status(404).json({ message: 'No templates found' });
      return;
    }
    res.status(200).json({ templates });
  } catch (error: any) {
    logger.error('Fetching templates failed', error);
    res.status(500).json({ message: 'Internal server error' });
    return;
  }
};
