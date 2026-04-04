import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Sale from '../models/Sale';
import Product from '../models/Product';
import { byUser, createLocalRecord, getCollection, readLocalDb, sortByDateDesc, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

export const getSales = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      return res.json(sortByDateDesc(byUser(getCollection(payload, 'sales'), req.user?.id), 'createdAt'));
    }
    const sales = await Sale.find({ userId: req.user?.id }).sort({ createdAt: -1 });
    res.json(sales);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createSale = async (req: AuthRequest, res: Response) => {
  try {
    const { items, totalAmount, tvaAmount, paymentMethod } = req.body;

    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const products = getCollection(payload, 'products');
      const sales = getCollection(payload, 'sales');

      for (const item of items) {
        const product = products.find((entry: any) => String(entry._id) === String(item.productId) && String(entry.userId) === String(req.user?.id));
        if (product) {
          product.stock = Number(product.stock || 0) - Number(item.quantity || 0);
        }
      }

      const sale = createLocalRecord({
        items,
        totalAmount: Number(totalAmount),
        tvaAmount: Number(tvaAmount || 0),
        paymentMethod,
        userId: req.user?.id
      });
      sales.push(sale);
      await writeLocalDb(payload);
      return res.json(sale);
    }

    // Update stock for each product
    for (const item of items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      });
    }

    const sale = new Sale({
      items,
      totalAmount,
      tvaAmount,
      paymentMethod,
      userId: req.user?.id
    });
    await sale.save();

    // Check for low stock and simulate email notification
    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (product && product.stock < 10) {
        console.log(`[EMAIL SIMULATION] To: ${req.user?.id}, Subject: Low Stock Alert, Body: Product ${product.name} is low on stock (${product.stock} left).`);
      }
    }

    res.json(sale);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
