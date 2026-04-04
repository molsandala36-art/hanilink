import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  price: number; // Selling price (POS price)
  purchasePrice: number; // Initial price (Supplier price)
  stock: number; // Quantity
  category: string;
  tvaRate: number; // Selling TVA (TVA client)
  supplierTva: number; // Supplier TVA (TVA fournisseur)
  place: string; // Storage location
  photoUrl: string; // Base64 or URL
  supplierId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  purchasePrice: { type: Number, default: 0 },
  stock: { type: Number, required: true },
  category: { type: String, default: 'General' },
  tvaRate: { type: Number, default: 20 },
  supplierTva: { type: Number, default: 20 },
  place: { type: String, default: '' },
  photoUrl: { type: String, default: '' },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IProduct>('Product', ProductSchema);
