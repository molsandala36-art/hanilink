import mongoose, { Schema, Document } from 'mongoose';

export interface IPOItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface IPurchaseOrder extends Document {
  supplierId: mongoose.Types.ObjectId;
  items: IPOItem[];
  status: 'Pending' | 'Received';
  expectedDeliveryDate: Date;
  totalAmount: number;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const POItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unitCost: { type: Number, required: true },
});

const PurchaseOrderSchema: Schema = new Schema({
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: [POItemSchema],
  status: { type: String, enum: ['Pending', 'Received'], default: 'Pending' },
  expectedDeliveryDate: { type: Date },
  totalAmount: { type: Number, required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
