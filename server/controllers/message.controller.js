import prisma from '../config/database.js';

const messageInclude = {
  sender: { select: { id: true, name: true, avatar_url: true } },
  reply_to: {
    select: {
      id: true,
      content: true,
      sender: { select: { name: true } },
    },
  },
  reactions: {
    include: { user: { select: { id: true, name: true } } },
  },
  statuses: {
    select: { user_id: true, status: true },
  },
};

const isUserChatMember = async (chatId, userId) => {
  const membership = await prisma.chatMember.findUnique({
    where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
  });
  return !!membership;
};

export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { cursor, limit = '30' } = req.query;
    const pageSize = Math.min(parseInt(limit, 10), 50);
    const userId = req.user.userId;

    const isMember = await isUserChatMember(chatId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const where = {
      chat_id: chatId,
      ...(cursor ? { created_at: { lt: new Date(cursor) } } : {}),
    };

    // Fetch one extra to determine if more pages exist
    const messages = await prisma.message.findMany({
      where,
      include: messageInclude,
      orderBy: { created_at: 'desc' },
      take: pageSize + 1,
    });

    const hasMore = messages.length > pageSize;
    if (hasMore) messages.pop();

    // Oldest messages first in the response
    messages.reverse();

    const nextCursor = hasMore ? messages[0].created_at.toISOString() : null;

    return res.status(200).json({ messages, nextCursor, hasMore });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load messages. Please try again.' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, type = 'text', replyToId } = req.body;
    const userId = req.user.userId;

    const isMember = await isUserChatMember(chatId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    if (!content?.trim() && !req.file) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    let fileUrl = null;
    let messageType = type;

    if (req.file) {
      fileUrl = req.file.path;
      messageType = req.file.mimetype === 'application/pdf' ? 'file' : 'image';
    }

    const message = await prisma.message.create({
      data: {
        chat_id: chatId,
        sender_id: userId,
        content: content?.trim() ?? null,
        type: messageType,
        file_url: fileUrl,
        reply_to_id: replyToId ?? null,
      },
      include: messageInclude,
    });

    await prisma.chat.update({ where: { id: chatId }, data: { updated_at: new Date() } });

    return res.status(201).json(message);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to send message. Please try again.' });
  }
};

export const editMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content?.trim()) {
      return res.status(400).json({ message: 'Message content cannot be empty' });
    }

    const existing = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existing) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (existing.sender_id !== userId) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }

    const updated = await prisma.message.update({
      where: { id: messageId },
      data: { content: content.trim(), is_edited: true, edited_at: new Date() },
      include: messageInclude,
    });

    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to edit message. Please try again.' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const existing = await prisma.message.findUnique({ where: { id: messageId } });
    if (!existing) {
      return res.status(404).json({ message: 'Message not found' });
    }

    if (existing.sender_id !== userId) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { is_deleted: true },
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to delete message. Please try again.' });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.userId;

    if (!emoji) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

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

    return res.status(200).json(reactions);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update reaction. Please try again.' });
  }
};

export const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q } = req.query;
    const userId = req.user.userId;

    if (!q?.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const isMember = await isUserChatMember(chatId, userId);
    if (!isMember) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const messages = await prisma.message.findMany({
      where: {
        chat_id: chatId,
        is_deleted: false,
        content: { contains: q.trim(), mode: 'insensitive' },
      },
      include: { sender: { select: { id: true, name: true, avatar_url: true } } },
      orderBy: { created_at: 'desc' },
      take: 30,
    });

    return res.status(200).json(messages);
  } catch (err) {
    return res.status(500).json({ message: 'Search failed. Please try again.' });
  }
};
