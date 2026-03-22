import { Router } from 'express';
import { searchUsers, updateProfile } from '../controllers/user.controller.js';
import authenticate from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = Router();

router.get('/search', authenticate, searchUsers);
router.patch('/me', authenticate, upload.single('file'), updateProfile);

export default router;
