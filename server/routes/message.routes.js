import { Router } from 'express';
import {
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  searchMessages,
} from '../controllers/message.controller.js';
import authenticate from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimiter.js';
import upload from '../middleware/upload.js';

const router = Router();

// Specific sub-routes must be declared before the wildcard /:chatId routes
router.get('/:chatId/search', authenticate, searchMessages);
router.get('/:chatId', authenticate, getMessages);
router.post('/:chatId', authenticate, messageLimiter, upload.single('file'), sendMessage);
router.patch('/:messageId', authenticate, editMessage);
router.delete('/:messageId', authenticate, deleteMessage);
router.post('/:messageId/react', authenticate, reactToMessage);

export default router;
