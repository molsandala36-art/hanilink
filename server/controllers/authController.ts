import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs/promises';
import jwt from 'jsonwebtoken';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import User from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'server', 'data', 'local-db.json');

type LocalDbPayload = {
  meta?: {
    lastPullAt: string | null;
    lastPushAt: string | null;
  };
  collections?: Record<string, any[]>;
};

const ensureLocalDb = async () => {
  await fs.mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  try {
    await fs.access(LOCAL_DB_PATH);
  } catch {
    await fs.writeFile(
      LOCAL_DB_PATH,
      JSON.stringify({ meta: { lastPullAt: null, lastPushAt: null }, collections: { users: [] } }, null, 2),
      'utf-8'
    );
  }
};

const readLocalDb = async (): Promise<LocalDbPayload> => {
  await ensureLocalDb();
  const raw = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
  return JSON.parse(raw || '{}');
};

const writeLocalDb = async (payload: LocalDbPayload) => {
  await ensureLocalDb();
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(payload, null, 2), 'utf-8');
};

const toAuthUser = (user: any) => ({
  id: String(user._id || user.id),
  name: user.name,
  email: user.email,
  shopName: user.shopName,
  ice: user.ice || '',
  if: user.if || '',
  rc: user.rc || '',
  address: user.address || '',
  role: user.role
});

const useLocalAuthStore = () =>
  process.env.DESKTOP_EMBEDDED === '1' && mongoose.connection.readyState !== 1;

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, shopName, role } = req.body;

    if (useLocalAuthStore()) {
      const payload = await readLocalDb();
      const collections = payload.collections || {};
      const users = collections.users || [];
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const existingUser = users.find((entry: any) => String(entry.email || '').trim().toLowerCase() === normalizedEmail);

      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const user = {
        _id: randomUUID(),
        name,
        email: normalizedEmail,
        password: hashedPassword,
        shopName,
        ice: '',
        if: '',
        rc: '',
        address: '',
        role: role || 'admin',
        createdAt: new Date().toISOString()
      };

      collections.users = [...users, user];
      payload.collections = collections;
      await writeLocalDb(payload);

      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: toAuthUser(user) });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({ name, email, password: hashedPassword, shopName, role: role || 'admin' });
    await user.save();

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: toAuthUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (useLocalAuthStore()) {
      const payload = await readLocalDb();
      const users = payload.collections?.users || [];
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const user = users.find((entry: any) => String(entry.email || '').trim().toLowerCase() === normalizedEmail);

      if (!user) return res.status(400).json({ message: 'Invalid credentials' });

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

      const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: toAuthUser(user) });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: toAuthUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
