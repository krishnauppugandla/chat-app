import { Router } from 'express';
import { getChats, createChat, addMembers, removeMember } from '../controllers/chat.controller.js';
import authenticate from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, getChats);
router.post('/', authenticate, createChat);
router.post('/:id/members', authenticate, addMembers);
router.delete('/:id/members/:userId', authenticate, removeMember);

export default router;
