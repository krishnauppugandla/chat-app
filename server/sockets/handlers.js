import prisma from '../config/database.js';
import { setOnline, setOffline } from './presence.js';

// Track active typing timers: `${userId}:${chatId}` → timer
const typingTimers = new Map();

const messageInclude = {
  sender: { select: { id: true, name: true, avatar_url: true } },
  reply_to: {
    select: {
      id: true,
      content: true,
      sender: { select: { name: true } },
    },
  },
  reactions: { include: { user: { select: { id: true, name: true } } } },
  statuses: { select: { user_id: true, status: true } },
};

const isUserChatMember = async (chatId, userId) => {
  const membership = await prisma.chatMember.findUnique({
    where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
  });
  return !!membership;
};

export const handleConnection = async (io, socket) => {
  const userId = socket.user.userId;

  await setOnline(userId);
  socket.broadcast.emit('user_online', { userId });

  // Join all chat rooms this user belongs to
  const memberships = await prisma.chatMember.findMany({
    where: { user_id: userId },
    select: { chat_id: true },
  });

  memberships.forEach(({ chat_id }) => socket.join(chat_id));

  socket.on('send_message', async ({ chatId, content, type = 'text', replyToId, tempId }) => {
    try {
      const isMember = await isUserChatMember(chatId, userId);
      if (!isMember) return;

      const message = await prisma.message.create({
        data: {
          chat_id: chatId,
          sender_id: userId,
          content: content?.trim() ?? null,
          type,
          reply_to_id: replyToId ?? null,
        },
        include: messageInclude,
      });

      await prisma.chat.update({ where: { id: chatId }, data: { updated_at: new Date() } });

      io.to(chatId).emit('new_message', { ...message, tempId });
    } catch (err) {
      socket.emit('message_error', { tempId, message: 'Failed to send message' });
    }
  });

  socket.on('typing_start', ({ chatId }) => {
    const timerKey = `${userId}:${chatId}`;

    socket.to(chatId).emit('user_typing', { userId, chatId, name: socket.user.name });

    const existing = typingTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      socket.to(chatId).emit('user_stopped_typing', { userId, chatId });
      typingTimers.delete(timerKey);
    }, 3000);

    typingTimers.set(timerKey, timer);
  });

  socket.on('typing_stop', ({ chatId }) => {
    const timerKey = `${userId}:${chatId}`;
    const existing = typingTimers.get(timerKey);
    if (existing) {
      clearTimeout(existing);
      typingTimers.delete(timerKey);
    }
    socket.to(chatId).emit('user_stopped_typing', { userId, chatId });
  });

  socket.on('mark_seen', async ({ chatId, messageId }) => {
    try {
      await prisma.messageStatus.upsert({
        where: { message_id_user_id: { message_id: messageId, user_id: userId } },
        create: { message_id: messageId, user_id: userId, status: 'seen' },
        update: { status: 'seen' },
      });

      socket.to(chatId).emit('seen_by', { messageId, userId });
    } catch {
      // Non-critical: silently ignore mark-seen failures
    }
  });

  socket.on('edit_message', async ({ messageId, content, chatId }) => {
    try {
      const existing = await prisma.message.findUnique({ where: { id: messageId } });
      if (!existing || existing.sender_id !== userId) return;

      const updated = await prisma.message.update({
        where: { id: messageId },
        data: { content: content.trim(), is_edited: true, edited_at: new Date() },
      });

      io.to(chatId).emit('message_edited', {
        messageId,
        content: updated.content,
        edited_at: updated.edited_at,
      });
    } catch {
      socket.emit('message_error', { message: 'Failed to edit message' });
    }
  });

  socket.on('delete_message', async ({ messageId, chatId }) => {
    try {
      const existing = await prisma.message.findUnique({ where: { id: messageId } });
      if (!existing || existing.sender_id !== userId) return;

      await prisma.message.update({ where: { id: messageId }, data: { is_deleted: true } });

      io.to(chatId).emit('message_deleted', { messageId });
    } catch {
      socket.emit('message_error', { message: 'Failed to delete message' });
    }
  });

  socket.on('react', async ({ messageId, emoji, chatId }) => {
    try {
      const existing = await prisma.reaction.findUnique({
        where: { message_id_user_id_emoji: { message_id: messageId, user_id: userId, emoji } },
      });

      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
      } else {
        await prisma.reaction.create({ data: { message_id: messageId, user_id: userId, emoji } });
      }

      const reactions = await prisma.reaction.findMany({
        where: { message_id: messageId },
        include: { user: { select: { id: true, name: true } } },
      });

      io.to(chatId).emit('reaction_updated', { messageId, reactions });
    } catch {
      socket.emit('message_error', { message: 'Failed to update reaction' });
    }
  });

  socket.on('disconnect', async () => {
    // Clean up any pending typing timers for this user
    for (const [key, timer] of typingTimers.entries()) {
      if (key.startsWith(`${userId}:`)) {
        clearTimeout(timer);
        typingTimers.delete(key);
      }
    }

    try {
      await setOffline(userId);
      const lastSeen = new Date();
      await prisma.user.update({ where: { id: userId }, data: { last_seen: lastSeen } });
      socket.broadcast.emit('user_offline', { userId, last_seen: lastSeen });
    } catch {
      // Don't crash on disconnect cleanup failures
    }
  });
};
