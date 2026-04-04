import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';

export type LocalDbPayload = {
  meta?: {
    lastPullAt: string | null;
    lastPushAt: string | null;
  };
  collections?: Record<string, any[]>;
};

const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'server', 'data', 'local-db.json');

export const useLocalDbStore = () =>
  process.env.DESKTOP_EMBEDDED === '1' && mongoose.connection.readyState !== 1;

export const ensureLocalDb = async () => {
  await fs.mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  try {
    await fs.access(LOCAL_DB_PATH);
  } catch {
    await fs.writeFile(
      LOCAL_DB_PATH,
      JSON.stringify({ meta: { lastPullAt: null, lastPushAt: null }, collections: {} }, null, 2),
      'utf-8'
    );
  }
};

export const readLocalDb = async (): Promise<LocalDbPayload> => {
  await ensureLocalDb();
  const raw = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
  return JSON.parse(raw || '{}');
};

export const writeLocalDb = async (payload: LocalDbPayload) => {
  await ensureLocalDb();
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(payload, null, 2), 'utf-8');
};

export const getCollection = (payload: LocalDbPayload, key: string) => {
  const collections = payload.collections || {};
  const items = collections[key] || [];
  collections[key] = items;
  payload.collections = collections;
  return items;
};

export const setCollection = (payload: LocalDbPayload, key: string, items: any[]) => {
  payload.collections = {
    ...(payload.collections || {}),
    [key]: items
  };
};

export const createLocalRecord = (data: Record<string, any>) => ({
  _id: randomUUID(),
  createdAt: new Date().toISOString(),
  ...data
});

export const byUser = (items: any[], userId?: string) =>
  items.filter((item) => !userId || String(item.userId) === String(userId));

export const sortByDateDesc = (items: any[], ...keys: string[]) =>
  [...items].sort((a, b) => {
    for (const key of keys) {
      const aTime = new Date(a?.[key] || 0).getTime();
      const bTime = new Date(b?.[key] || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;
    }
    return 0;
  });

