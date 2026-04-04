import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  title: string;
  amount: number;
  category: string;
  expenseDate: Date;
  notes?: string;
  userId: mongoose.Types.ObjectId;
  createdAt: Date;
}

const ExpenseSchema: Schema = new Schema({
  title: { type: String, required: true, trim: true },
  amount: { type: Number, required: true, min: 0 },
  category: { type: String, default: 'General', trim: true },
  expenseDate: { type: Date, default: Date.now },
  notes: { type: String, default: '' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
