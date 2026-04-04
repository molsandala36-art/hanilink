import mongoose, { Schema, Document } from 'mongoose';

export interface ILicense extends Document {
  key: string; // HANI-XXXX-YYYY
  hwid: string; // Linked HWID
  status: 'Active' | 'Disabled';
  ownerId: mongoose.Types.ObjectId; // User who owns this license
  createdAt: Date;
  activatedAt: Date;
}

const LicenseSchema: Schema = new Schema({
  key: { type: String, required: true, unique: true },
  hwid: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Disabled'], default: 'Active' },
  ownerId: { type: Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  activatedAt: { type: Date },
});

export default mongoose.model<ILicense>('License', LicenseSchema);
