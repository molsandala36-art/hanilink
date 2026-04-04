import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  shopName: string;
  ice: string;
  if: string;
  rc: string;
  address: string;
  role: 'admin' | 'employee';
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  shopName: { type: String, required: true },
  ice: { type: String, default: '' },
  if: { type: String, default: '' },
  rc: { type: String, default: '' },
  address: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'employee'], default: 'admin' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IUser>('User', UserSchema);
