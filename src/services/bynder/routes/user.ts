import express from 'express';
import { updateUser } from '../services/userService.js';

const userRouter = express.Router();

userRouter.put('/', updateUser);

export default userRouter;
