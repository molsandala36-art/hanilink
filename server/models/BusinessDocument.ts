import mongoose, { Schema, Document } from 'mongoose';

export type BusinessDocumentType = 'quote' | 'delivery_note' | 'invoice';
export type BusinessDocumentStatus = 'draft' | 'sent' | 'validated';

export interface IBusinessDocumentItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface IBusinessDocument extends Document {
  documentType: BusinessDocumentType;
  documentNumber: string;
  sourceDocumentId?: mongoose.Types.ObjectId;
  sourceDocumentType?: BusinessDocumentType;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  issueDate: Date;
  dueDate?: Date;
  status: BusinessDocumentStatus;
  items: IBusinessDocumentItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const BusinessDocumentItemSchema = new Schema({
  description: { type: String, required: true, trim: true },
  quantity: { type: Number, required: true, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  lineTotal: { type: Number, required: true, min: 0 }
});

const BusinessDocumentSchema: Schema = new Schema({
  documentType: { type: String, enum: ['quote', 'delivery_note', 'invoice'], required: true },
  documentNumber: { type: String, required: true, trim: true },
  sourceDocumentId: { type: Schema.Types.ObjectId, ref: 'BusinessDocument' },
  sourceDocumentType: { type: String, enum: ['quote', 'delivery_note', 'invoice'] },
  customerName: { type: String, required: true, trim: true },
  customerPhone: { type: String, default: '' },
  customerAddress: { type: String, default: '' },
  issueDate: { type: Date, default: Date.now },
  dueDate: { type: Date },
  status: { type: String, enum: ['draft', 'sent', 'validated'], default: 'draft' },
  items: [BusinessDocumentItemSchema],
  subtotal: { type: Number, required: true, min: 0 },
  taxAmount: { type: Number, required: true, min: 0 },
  totalAmount: { type: Number, required: true, min: 0 },
  notes: { type: String, default: '' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IBusinessDocument>('BusinessDocument', BusinessDocumentSchema);
