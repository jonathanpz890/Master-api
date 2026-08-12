import express from 'express';
import passport from 'passport';
import { authenticateUser } from '../services/userService.js';
import { getTemplates } from '../services/templatesServices.js';

const templatesRouter = express.Router();

templatesRouter.get('/', getTemplates)

export default templatesRouter;