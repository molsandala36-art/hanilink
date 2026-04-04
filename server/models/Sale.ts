import mongoose, { Schema, Document } from 'mongoose';

export interface ISaleItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  price: number;
  tvaRate: number;
}

export interface ISale extends Document {
  items: ISaleItem[];
  totalAmount: number;
  tvaAmount: number;
  paymentMethod: 'cash' | 'card' | 'cmi';
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const SaleSchema: Schema = new Schema({
  items: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: Number,
    price: Number,
    tvaRate: Number
  }],
  totalAmount: { type: Number, required: true },
  tvaAmount: { type: Number, default: 0 },
  paymentMethod: { type: String, enum: ['cash', 'card', 'cmi'], default: 'cash' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<ISale>('Sale', SaleSchema);
