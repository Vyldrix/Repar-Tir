import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { loginRateLimiter } from '../middlewares/rate-limit.middleware.js';

const authRouter = Router();

authRouter.post('/register', AuthController.register);
authRouter.post('/login', loginRateLimiter, AuthController.login);
authRouter.post('/refresh', AuthController.refresh);
authRouter.post('/logout', AuthController.logout);
authRouter.post('/revoke', AuthController.revoke);

export default authRouter;
