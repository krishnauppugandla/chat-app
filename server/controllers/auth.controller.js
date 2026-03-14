import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';

const generateTokenPair = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar_url: user.avatar_url,
  bio: user.bio,
  created_at: user.created_at,
});

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password_hash,
      },
    });

    const { accessToken, refreshToken } = generateTokenPair(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refresh_token: refreshToken } });

    return res.status(201).json({ accessToken, refreshToken, user: safeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokenPair(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refresh_token: refreshToken } });

    return res.status(200).json({ accessToken, refreshToken, user: safeUser(user) });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const refresh = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token is required' });
    }

    let payload;
    try {
      payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token' });
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || user.refresh_token !== refreshToken) {
      // Token reuse detected — revoke the session
      if (user) await prisma.user.update({ where: { id: user.id }, data: { refresh_token: null } });
      return res.status(401).json({ message: 'Session invalidated. Please log in again.' });
    }

    const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { refresh_token: newRefreshToken } });

    return res.status(200).json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json(safeUser(user));
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

export const logout = async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { refresh_token: null },
    });
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
