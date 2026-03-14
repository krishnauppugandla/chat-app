import { Router } from 'express';
import { register, login, refresh, getMe, logout } from '../controllers/auth.controller.js';
import authenticate from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
