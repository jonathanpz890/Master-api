import express from 'express';
import { searchWorkspace } from '../services/searchServices.js';

const searchRouter = express.Router();
searchRouter.get('/', searchWorkspace);

export default searchRouter;
