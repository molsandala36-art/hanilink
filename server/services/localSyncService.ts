import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User';
import Product from '../models/Product';
import Supplier from '../models/Supplier';
import PurchaseOrder from '../models/PurchaseOrder';
import Sale from '../models/Sale';
import License from '../models/License';
import Expense from '../models/Expense';
import BusinessDocument from '../models/BusinessDocument';

type LocalDbPayload = {
  meta: {
    lastPullAt: string | null;
    lastPushAt: string | null;
    lastDrivePullAt?: string | null;
    lastDrivePushAt?: string | null;
  };
  collections: Record<string, any[]>;
};

type SyncSettings = {
  googleDriveFolderPath: string;
};

const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(process.cwd(), 'server', 'data', 'local-db.json');
const SYNC_SETTINGS_PATH = path.join(path.dirname(LOCAL_DB_PATH), 'sync-settings.json');
const GOOGLE_DRIVE_FILE_NAME = 'hanilink-local-db.json';

const MODELS: Array<{ key: string; model: any }> = [
  { key: 'users', model: User },
  { key: 'products', model: Product },
  { key: 'suppliers', model: Supplier },
  { key: 'purchaseOrders', model: PurchaseOrder },
  { key: 'sales', model: Sale },
  { key: 'licenses', model: License },
  { key: 'expenses', model: Expense },
  { key: 'businessDocuments', model: BusinessDocument }
];

const EMPTY_DB: LocalDbPayload = {
  meta: {
    lastPullAt: null,
    lastPushAt: null,
    lastDrivePullAt: null,
    lastDrivePushAt: null
  },
  collections: {}
};

const EMPTY_SYNC_SETTINGS: SyncSettings = {
  googleDriveFolderPath: ''
};

const ensureDbFile = async () => {
  await fs.mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  try {
    await fs.access(LOCAL_DB_PATH);
  } catch {
    await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(EMPTY_DB, null, 2), 'utf-8');
  }
};

const ensureSyncSettingsFile = async () => {
  await fs.mkdir(path.dirname(SYNC_SETTINGS_PATH), { recursive: true });
  try {
    await fs.access(SYNC_SETTINGS_PATH);
  } catch {
    await fs.writeFile(SYNC_SETTINGS_PATH, JSON.stringify(EMPTY_SYNC_SETTINGS, null, 2), 'utf-8');
  }
};

const readLocalDb = async (): Promise<LocalDbPayload> => {
  await ensureDbFile();
  const raw = await fs.readFile(LOCAL_DB_PATH, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  return {
    meta: {
      lastPullAt: parsed?.meta?.lastPullAt || null,
      lastPushAt: parsed?.meta?.lastPushAt || null,
      lastDrivePullAt: parsed?.meta?.lastDrivePullAt || null,
      lastDrivePushAt: parsed?.meta?.lastDrivePushAt || null
    },
    collections: parsed?.collections || {}
  };
};

const writeLocalDb = async (payload: LocalDbPayload) => {
  await ensureDbFile();
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(payload, null, 2), 'utf-8');
};

const readSyncSettings = async (): Promise<SyncSettings> => {
  await ensureSyncSettingsFile();
  const raw = await fs.readFile(SYNC_SETTINGS_PATH, 'utf-8');
  const parsed = JSON.parse(raw || '{}');
  return {
    googleDriveFolderPath: parsed?.googleDriveFolderPath || ''
  };
};

const writeSyncSettings = async (payload: SyncSettings) => {
  await ensureSyncSettingsFile();
  await fs.writeFile(SYNC_SETTINGS_PATH, JSON.stringify(payload, null, 2), 'utf-8');
};

const resolveGoogleDriveBackupPath = async () => {
  const settings = await readSyncSettings();
  const folderPath = settings.googleDriveFolderPath.trim();

  if (!folderPath) {
    throw new Error('Google Drive folder is not configured');
  }

  return {
    folderPath,
    filePath: path.join(folderPath, GOOGLE_DRIVE_FILE_NAME)
  };
};

export const pullMongoToLocal = async () => {
  if (mongoose.connection.readyState !== 1) {
    return {
      skipped: true,
      reason: 'MongoDB is not connected',
      localDbPath: LOCAL_DB_PATH,
      counts: {},
      lastPullAt: null
    };
  }

  const nextPayload: LocalDbPayload = {
    meta: {
      lastPullAt: new Date().toISOString(),
      lastPushAt: null
    },
    collections: {}
  };

  for (const { key, model } of MODELS) {
    nextPayload.collections[key] = await model.find({}).lean();
  }

  const current = await readLocalDb();
  nextPayload.meta.lastPushAt = current.meta.lastPushAt;
  await writeLocalDb(nextPayload);

  return {
    localDbPath: LOCAL_DB_PATH,
    counts: Object.fromEntries(Object.entries(nextPayload.collections).map(([k, v]) => [k, v.length])),
    lastPullAt: nextPayload.meta.lastPullAt
  };
};

export const pushLocalToMongo = async () => {
  if (mongoose.connection.readyState !== 1) {
    const payload = await readLocalDb();

    return {
      skipped: true,
      reason: 'MongoDB is not connected',
      localDbPath: LOCAL_DB_PATH,
      counts: Object.fromEntries(
        Object.entries(payload.collections).map(([key, docs]) => [key, (docs || []).length])
      ),
      lastPushAt: payload.meta.lastPushAt
    };
  }

  const payload = await readLocalDb();
  const counts: Record<string, number> = {};

  for (const { key, model } of MODELS) {
    const docs = (payload.collections[key] || []).filter((doc: any) => doc && doc._id);
    counts[key] = docs.length;

    if (!docs.length) continue;

    await model.bulkWrite(
      docs.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      })),
      { ordered: false }
    );
  }

  payload.meta.lastPushAt = new Date().toISOString();
  await writeLocalDb(payload);

  return {
    localDbPath: LOCAL_DB_PATH,
    counts,
    lastPushAt: payload.meta.lastPushAt
  };
};

export const getLocalSyncStatus = async () => {
  await ensureDbFile();
  const stats = await fs.stat(LOCAL_DB_PATH);
  const payload = await readLocalDb();
  const syncSettings = await readSyncSettings();
  const collectionCounts = Object.fromEntries(
    Object.entries(payload.collections).map(([key, docs]) => [key, (docs || []).length])
  );

  const googleDriveFolderPath = syncSettings.googleDriveFolderPath.trim();
  const googleDriveFilePath = googleDriveFolderPath ? path.join(googleDriveFolderPath, GOOGLE_DRIVE_FILE_NAME) : '';
  let googleDriveFileExists = false;
  let googleDriveFileSizeBytes = 0;

  if (googleDriveFilePath) {
    try {
      const driveStats = await fs.stat(googleDriveFilePath);
      googleDriveFileExists = true;
      googleDriveFileSizeBytes = driveStats.size;
    } catch {
      googleDriveFileExists = false;
      googleDriveFileSizeBytes = 0;
    }
  }

  return {
    localDbPath: LOCAL_DB_PATH,
    mongoConnected: mongoose.connection.readyState === 1,
    fileSizeBytes: stats.size,
    lastPullAt: payload.meta.lastPullAt,
    lastPushAt: payload.meta.lastPushAt,
    lastDrivePullAt: payload.meta.lastDrivePullAt || null,
    lastDrivePushAt: payload.meta.lastDrivePushAt || null,
    collectionCounts,
    googleDriveFolderPath,
    googleDriveFilePath,
    googleDriveFileExists,
    googleDriveFileSizeBytes
  };
};

export const configureGoogleDriveSync = async (googleDriveFolderPath: string) => {
  const trimmedPath = String(googleDriveFolderPath || '').trim();

  if (!trimmedPath) {
    await writeSyncSettings(EMPTY_SYNC_SETTINGS);
    return {
      googleDriveFolderPath: '',
      googleDriveFilePath: '',
      configured: false
    };
  }

  await fs.mkdir(trimmedPath, { recursive: true });
  await writeSyncSettings({ googleDriveFolderPath: trimmedPath });

  return {
    googleDriveFolderPath: trimmedPath,
    googleDriveFilePath: path.join(trimmedPath, GOOGLE_DRIVE_FILE_NAME),
    configured: true
  };
};

export const pushLocalToGoogleDrive = async () => {
  await ensureDbFile();
  const { folderPath, filePath } = await resolveGoogleDriveBackupPath();
  const payload = await readLocalDb();

  await fs.mkdir(folderPath, { recursive: true });
  await fs.copyFile(LOCAL_DB_PATH, filePath);

  payload.meta.lastDrivePushAt = new Date().toISOString();
  await writeLocalDb(payload);

  const stats = await fs.stat(filePath);

  return {
    googleDriveFolderPath: folderPath,
    googleDriveFilePath: filePath,
    fileSizeBytes: stats.size,
    lastDrivePushAt: payload.meta.lastDrivePushAt
  };
};

export const pullGoogleDriveToLocal = async () => {
  const { filePath, folderPath } = await resolveGoogleDriveBackupPath();

  try {
    await fs.access(filePath);
  } catch {
    throw new Error('Google Drive backup file not found');
  }

  await fs.copyFile(filePath, LOCAL_DB_PATH);

  const payload = await readLocalDb();
  payload.meta.lastDrivePullAt = new Date().toISOString();
  await writeLocalDb(payload);

  const stats = await fs.stat(filePath);

  return {
    googleDriveFolderPath: folderPath,
    googleDriveFilePath: filePath,
    fileSizeBytes: stats.size,
    lastDrivePullAt: payload.meta.lastDrivePullAt
  };
};

export const startAutoLocalPull = () => {
  const intervalMs = Number(process.env.LOCAL_SYNC_PULL_INTERVAL_MS || 60000);
  if (!Number.isFinite(intervalMs) || intervalMs < 10000) {
    return;
  }

  setInterval(async () => {
    if (mongoose.connection.readyState !== 1) return;
    try {
      await pullMongoToLocal();
    } catch (err) {
      console.error('[LocalSync] Auto pull failed:', err);
    }
  }, intervalMs);
};
