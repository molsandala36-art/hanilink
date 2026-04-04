import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import mongoose from 'mongoose';
import License from '../models/License';

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
      JSON.stringify({ meta: { lastPullAt: null, lastPushAt: null }, collections: { licenses: [] } }, null, 2),
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

const ensureDefaultLocalLicense = (payload: LocalDbPayload) => {
  const collections = payload.collections || {};
  const licenses = collections.licenses || [];
  const existing = licenses.find((entry: any) => String(entry.key || '').trim().toUpperCase() === 'HANI-DEMO-2026');

  if (!existing) {
    licenses.unshift({
      _id: 'hani-demo-2026',
      key: 'HANI-DEMO-2026',
      hwid: '',
      status: 'Active',
      createdAt: new Date().toISOString()
    });
  }

  collections.licenses = licenses;
  payload.collections = collections;
  return payload;
};

const useLocalLicenseStore = () =>
  process.env.DESKTOP_EMBEDDED === '1' && mongoose.connection.readyState !== 1;

const isRebindableLocalLicense = (license: any) =>
  String(license?.key || '').trim().toUpperCase() === 'HANI-DEMO-2026';

export const activateLicense = async (req: any, res: Response) => {
  const { key, hwid } = req.body;
  try {
    if (useLocalLicenseStore()) {
      const payload = ensureDefaultLocalLicense(await readLocalDb());
      const collections = payload.collections || {};
      const licenses = collections.licenses || [];
      const normalizedKey = String(key || '').trim().toUpperCase();
      const license = licenses.find((entry: any) => String(entry.key || '').trim().toUpperCase() === normalizedKey);

      if (!license) return res.status(404).json({ message: 'Invalid license key' });
      if (license.status === 'Disabled') return res.status(403).json({ message: 'License disabled' });
      if (license.hwid && license.hwid !== hwid && !isRebindableLocalLicense(license)) {
        return res.status(403).json({ message: 'License already linked to another device' });
      }

      license.hwid = hwid;
      license.activatedAt = new Date().toISOString();
      license.ownerId = req.user.id;
      collections.licenses = licenses;
      payload.collections = collections;
      await writeLocalDb(payload);

      return res.json({ success: true, message: 'License activated', license });
    }

    const license = await License.findOne({ key });
    if (!license) return res.status(404).json({ message: 'Invalid license key' });
    if (license.status === 'Disabled') return res.status(403).json({ message: 'License disabled' });
    if (license.hwid && license.hwid !== hwid) return res.status(403).json({ message: 'License already linked to another device' });

    license.hwid = hwid;
    license.activatedAt = new Date();
    license.ownerId = req.user.id;
    await license.save();

    res.json({ success: true, message: 'License activated', license });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const verifyLicense = async (req: any, res: Response) => {
  const { hwid } = req.body;
  try {
    if (useLocalLicenseStore()) {
      const payload = ensureDefaultLocalLicense(await readLocalDb());
      const licenses = payload.collections?.licenses || [];
      const license = licenses.find((entry: any) => entry.hwid === hwid && entry.ownerId === req.user.id);
      if (!license || license.status === 'Disabled') {
        return res.status(403).json({ active: false, message: 'Invalid or disabled license' });
      }
      return res.json({ active: true, license });
    }

    const license = await License.findOne({ hwid, ownerId: req.user.id });
    if (!license || license.status === 'Disabled') {
      return res.status(403).json({ active: false, message: 'Invalid or disabled license' });
    }
    res.json({ active: true, license });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Admin Routes
export const getLicenses = async (req: any, res: Response) => {
  try {
    if (useLocalLicenseStore()) {
      const payload = ensureDefaultLocalLicense(await readLocalDb());
      await writeLocalDb(payload);
      return res.json(payload.collections?.licenses || []);
    }

    const licenses = await License.find().populate('ownerId');
    res.json(licenses);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const generateLicense = async (req: any, res: Response) => {
  let { key } = req.body;
  try {
    if (!key) {
      key = 'HANI-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
    }

    if (useLocalLicenseStore()) {
      const payload = ensureDefaultLocalLicense(await readLocalDb());
      const collections = payload.collections || {};
      const licenses = collections.licenses || [];
      const existing = licenses.find((entry: any) => String(entry.key || '').trim().toUpperCase() === String(key).trim().toUpperCase());
      if (existing) return res.status(400).json({ message: 'License key already exists' });

      const license = {
        _id: randomUUID(),
        key,
        hwid: '',
        status: 'Active',
        createdAt: new Date().toISOString()
      };
      collections.licenses = [license, ...licenses];
      payload.collections = collections;
      await writeLocalDb(payload);
      return res.status(201).json(license);
    }

    const license = new License({ key });
    await license.save();
    res.status(201).json(license);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateLicenseStatus = async (req: any, res: Response) => {
  const { status } = req.body;
  try {
    if (useLocalLicenseStore()) {
      const payload = ensureDefaultLocalLicense(await readLocalDb());
      const licenses = payload.collections?.licenses || [];
      const license = licenses.find((entry: any) => String(entry._id) === String(req.params.id));
      if (!license) return res.status(404).json({ message: 'License not found' });
      license.status = status;
      await writeLocalDb(payload);
      return res.json(license);
    }

    const license = await License.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!license) return res.status(404).json({ message: 'License not found' });
    res.json(license);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteLicense = async (req: any, res: Response) => {
  try {
    if (useLocalLicenseStore()) {
      const payload = ensureDefaultLocalLicense(await readLocalDb());
      const licenses = payload.collections?.licenses || [];
      const nextLicenses = licenses.filter((entry: any) => String(entry._id) !== String(req.params.id));
      if (nextLicenses.length === licenses.length) return res.status(404).json({ message: 'License not found' });
      payload.collections = {
        ...(payload.collections || {}),
        licenses: nextLicenses
      };
      await writeLocalDb(payload);
      return res.json({ message: 'License deleted' });
    }

    const license = await License.findByIdAndDelete(req.params.id);
    if (!license) return res.status(404).json({ message: 'License not found' });
    res.json({ message: 'License deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
