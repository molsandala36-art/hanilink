import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplier extends Document {
  name: string;
  phone: string;
  address: string;
  email: string;
  linkedProducts: mongoose.Types.ObjectId[];
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SupplierSchema: Schema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, default: '' },
  address: { type: String, default: '' },
  email: { type: String, default: '' },
  linkedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ISupplier>('Supplier', SupplierSchema);
