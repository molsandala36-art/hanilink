import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  configureGoogleDriveSync,
  getLocalSyncStatus,
  pullGoogleDriveToLocal,
  pullMongoToLocal,
  pushLocalToGoogleDrive,
  pushLocalToMongo
} from '../services/localSyncService';

export const getSyncStatus = async (req: AuthRequest, res: Response) => {
  try {
    const status = await getLocalSyncStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to get sync status' });
  }
};

export const pullToLocal = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pullMongoToLocal();
    res.json({ message: 'MongoDB -> Local sync completed', ...result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to sync from MongoDB to local DB' });
  }
};

export const pushToMongo = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pushLocalToMongo();
    res.json({ message: 'Local -> MongoDB sync completed', ...result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to sync from local DB to MongoDB' });
  }
};

export const saveGoogleDriveConfig = async (req: AuthRequest, res: Response) => {
  try {
    const result = await configureGoogleDriveSync(req.body.googleDriveFolderPath || '');
    res.json({ message: 'Google Drive sync configured', ...result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to configure Google Drive sync' });
  }
};

export const pushToGoogleDrive = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pushLocalToGoogleDrive();
    res.json({ message: 'Local -> Google Drive sync completed', ...result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to sync from local DB to Google Drive' });
  }
};

export const pullFromGoogleDrive = async (req: AuthRequest, res: Response) => {
  try {
    const result = await pullGoogleDriveToLocal();
    res.json({ message: 'Google Drive -> Local sync completed', ...result });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to sync from Google Drive to local DB' });
  }
};
