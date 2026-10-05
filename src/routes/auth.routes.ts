import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { loginRateLimiter } from '../middlewares/rate-limit.middleware.js';

const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', loginRateLimiter, AuthController.login);

export default authRouter;
