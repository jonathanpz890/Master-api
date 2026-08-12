import express from 'express';
import * as DreamServices from '../services/DreamServices.js';

const dreamRouter = express.Router();

dreamRouter.get('/', DreamServices.getDreams);
dreamRouter.post('/', DreamServices.createDream);
dreamRouter.put('/:id', DreamServices.updateDream);
dreamRouter.delete('/:id', DreamServices.deleteDream);

export default dreamRouter;
