import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Expense from '../models/Expense';
import { byUser, createLocalRecord, getCollection, readLocalDb, setCollection, sortByDateDesc, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

export const getExpenses = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      return res.json(sortByDateDesc(byUser(getCollection(payload, 'expenses'), req.user?.id), 'expenseDate', 'createdAt'));
    }
    const expenses = await Expense.find({ userId: req.user?.id }).sort({ expenseDate: -1, createdAt: -1 });
    res.json(expenses);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch expenses' });
  }
};

export const createExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { title, amount, category, expenseDate, notes } = req.body;

    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const expenses = getCollection(payload, 'expenses');
      const expense = createLocalRecord({
        title,
        amount: Number(amount),
        category,
        expenseDate: expenseDate || new Date().toISOString(),
        notes,
        userId: req.user?.id
      });
      expenses.push(expense);
      await writeLocalDb(payload);
      return res.status(201).json(expense);
    }

    const expense = new Expense({
      title,
      amount,
      category,
      expenseDate,
      notes,
      userId: req.user?.id
    });

    await expense.save();
    res.status(201).json(expense);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to create expense' });
  }
};

export const updateExpense = async (req: AuthRequest, res: Response) => {
  try {
    const { title, amount, category, expenseDate, notes } = req.body;
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const expenses = getCollection(payload, 'expenses');
      const index = expenses.findIndex((expense: any) => String(expense._id) === String(req.params.id) && String(expense.userId) === String(req.user?.id));
      if (index === -1) {
        return res.status(404).json({ message: 'Expense not found' });
      }
      expenses[index] = { ...expenses[index], title, amount: Number(amount), category, expenseDate, notes };
      await writeLocalDb(payload);
      return res.json(expenses[index]);
    }
    const expense = await Expense.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      { title, amount, category, expenseDate, notes },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json(expense);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to update expense' });
  }
};

export const deleteExpense = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const expenses = getCollection(payload, 'expenses');
      const nextExpenses = expenses.filter((expense: any) => !(String(expense._id) === String(req.params.id) && String(expense.userId) === String(req.user?.id)));
      if (nextExpenses.length === expenses.length) {
        return res.status(404).json({ message: 'Expense not found' });
      }
      setCollection(payload, 'expenses', nextExpenses);
      await writeLocalDb(payload);
      return res.json({ message: 'Expense deleted' });
    }
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.json({ message: 'Expense deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete expense' });
  }
};
