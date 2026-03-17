import prisma from '../config/database.js';

const memberSelect = {
  id: true,
  chat_id: true,
  user_id: true,
  role: true,
  joined_at: true,
  user: { select: { id: true, name: true, avatar_url: true, last_seen: true } },
};

export const getChats = async (req, res) => {
  try {
    const userId = req.user.userId;

    const memberships = await prisma.chatMember.findMany({
      where: { user_id: userId },
      select: { chat_id: true },
    });

    const chatIds = memberships.map((m) => m.chat_id);

    const chats = await prisma.chat.findMany({
      where: { id: { in: chatIds } },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatar_url: true, last_seen: true } } } },
        messages: {
          where: { is_deleted: false },
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { sender: { select: { id: true, name: true } } },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    // Attach unread counts per chat
    const chatsWithMeta = await Promise.all(
      chats.map(async (chat) => {
        const lastSeen = await prisma.messageStatus.findFirst({
          where: {
            user_id: userId,
            status: 'seen',
            message: { chat_id: chat.id },
          },
          orderBy: { updated_at: 'desc' },
        });

        const unreadCount = await prisma.message.count({
          where: {
            chat_id: chat.id,
            sender_id: { not: userId },
            is_deleted: false,
            ...(lastSeen
              ? { created_at: { gt: lastSeen.updated_at } }
              : {}),
          },
        });

        return {
          ...chat,
          last_message: chat.messages[0] ?? null,
          unread_count: unreadCount,
          messages: undefined,
        };
      })
    );

    return res.status(200).json(chatsWithMeta);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to load chats. Please try again.' });
  }
};

export const createChat = async (req, res) => {
  try {
    const { userId, name, memberIds, is_group } = req.body;
    const requesterId = req.user.userId;

    if (is_group) {
      if (!name?.trim()) {
        return res.status(400).json({ message: 'Group name is required' });
      }
      if (!memberIds?.length) {
        return res.status(400).json({ message: 'At least one other member is required' });
      }

      const allMemberIds = [...new Set([requesterId, ...memberIds])];

      const chat = await prisma.chat.create({
        data: {
          name: name.trim(),
          is_group: true,
          created_by: requesterId,
          members: {
            create: allMemberIds.map((uid) => ({
              user_id: uid,
              role: uid === requesterId ? 'admin' : 'member',
            })),
          },
        },
        include: { members: { include: { user: { select: { id: true, name: true, avatar_url: true } } } } },
      });

      return res.status(201).json(chat);
    }

    // 1:1 chat
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required for a direct chat' });
    }

    if (userId === requesterId) {
      return res.status(400).json({ message: 'You cannot create a chat with yourself' });
    }

    // Check if a 1:1 chat already exists between these two users
    const existingMembership = await prisma.chatMember.findMany({
      where: { user_id: requesterId },
      select: { chat_id: true },
    });

    const requesterChatIds = existingMembership.map((m) => m.chat_id);

    const existingChat = await prisma.chat.findFirst({
      where: {
        id: { in: requesterChatIds },
        is_group: false,
        members: { some: { user_id: userId } },
      },
      include: { members: { include: { user: { select: { id: true, name: true, avatar_url: true } } } } },
    });

    if (existingChat) {
      return res.status(200).json(existingChat);
    }

    const chat = await prisma.chat.create({
      data: {
        is_group: false,
        created_by: requesterId,
        members: {
          create: [
            { user_id: requesterId },
            { user_id: userId },
          ],
        },
      },
      include: { members: { include: { user: { select: { id: true, name: true, avatar_url: true } } } } },
    });

    return res.status(201).json(chat);
  } catch (err) {
    return res.status(500).json({ message: 'Failed to create chat. Please try again.' });
  }
};

export const addMembers = async (req, res) => {
  try {
    const { id: chatId } = req.params;
    const { userIds } = req.body;
    const requesterId = req.user.userId;

    const requesterMembership = await prisma.chatMember.findUnique({
      where: { chat_id_user_id: { chat_id: chatId, user_id: requesterId } },
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    if (requesterMembership.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    await prisma.chatMember.createMany({
      data: userIds.map((uid) => ({ chat_id: chatId, user_id: uid })),
      skipDuplicates: true,
    });

    return res.status(200).json({ message: 'Members added successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to add members. Please try again.' });
  }
};

export const removeMember = async (req, res) => {
  try {
    const { id: chatId, userId } = req.params;
    const requesterId = req.user.userId;

    const requesterMembership = await prisma.chatMember.findUnique({
      where: { chat_id_user_id: { chat_id: chatId, user_id: requesterId } },
    });

    if (!requesterMembership) {
      return res.status(403).json({ message: 'You are not a member of this chat' });
    }

    const isRemovingSelf = userId === requesterId;
    if (!isRemovingSelf && requesterMembership.role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can remove other members' });
    }

    await prisma.chatMember.delete({
      where: { chat_id_user_id: { chat_id: chatId, user_id: userId } },
    });

    return res.status(200).json({ message: 'Member removed successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to remove member. Please try again.' });
  }
};
