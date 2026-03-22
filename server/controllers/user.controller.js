import prisma from '../config/database.js';

const safeUser = (user) => {
  const { password_hash, refresh_token, ...rest } = user;
  return rest;
};

export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q?.trim()) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: req.user.userId } },
          {
            OR: [
              { name: { contains: q.trim(), mode: 'insensitive' } },
              { email: { contains: q.trim(), mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, email: true, avatar_url: true },
      take: 20,
    });

    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({ message: 'Search failed. Please try again.' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, bio } = req.body;
    const updateData = {};

    if (name?.trim()) updateData.name = name.trim();
    if (bio !== undefined) updateData.bio = bio;
    if (req.file?.path) updateData.avatar_url = req.file.path;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const updated = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
    });

    return res.status(200).json(safeUser(updated));
  } catch (err) {
    return res.status(500).json({ message: 'Failed to update profile. Please try again.' });
  }
};
