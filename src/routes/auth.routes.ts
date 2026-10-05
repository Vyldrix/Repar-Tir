import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';

const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/revoke', AuthController.revoke);

export default authRouter;
