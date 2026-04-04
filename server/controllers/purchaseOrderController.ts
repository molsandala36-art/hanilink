import { Request, Response } from 'express';
import PurchaseOrder from '../models/PurchaseOrder';
import Product from '../models/Product';
import { byUser, createLocalRecord, getCollection, readLocalDb, sortByDateDesc, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

export const getPurchaseOrders = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const suppliers = getCollection(payload, 'suppliers');
      const purchaseOrders = byUser(getCollection(payload, 'purchaseOrders'), req.user.id).map((entry: any) => {
        const supplier = suppliers.find((item: any) => String(item._id) === String(entry.supplierId));
        return {
          ...entry,
          supplierId: supplier || entry.supplierId
        };
      });
      return res.json(sortByDateDesc(purchaseOrders, 'createdAt'));
    }
    const pos = await PurchaseOrder.find({ userId: req.user.id }).populate('supplierId');
    res.json(pos);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createPurchaseOrder = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const purchaseOrders = getCollection(payload, 'purchaseOrders');
      const items = (req.body.items || []).map((item: any) => ({
        productId: item.productId,
        name: item.name || '',
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unitCost ?? item.purchasePrice ?? 0)
      }));
      const po = createLocalRecord({
        supplierId: req.body.supplierId,
        expectedDeliveryDate: req.body.expectedDeliveryDate || req.body.expectedDate || null,
        status: req.body.status || 'Pending',
        totalAmount: Number(
          req.body.totalAmount ||
          items.reduce((sum: number, item: any) => sum + (Number(item.quantity || 0) * Number(item.unitCost || 0)), 0)
        ),
        items,
        userId: req.user.id
      });
      purchaseOrders.push(po);
      await writeLocalDb(payload);
      return res.status(201).json(po);
    }
    const po = new PurchaseOrder({
      ...req.body,
      userId: req.user.id,
    });
    await po.save();
    res.status(201).json(po);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const receivePurchaseOrder = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const purchaseOrders = getCollection(payload, 'purchaseOrders');
      const products = getCollection(payload, 'products');
      const po = purchaseOrders.find((entry: any) => String(entry._id) === String(req.params.id) && String(entry.userId) === String(req.user.id));
      if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
      if (po.status === 'Received') return res.status(400).json({ message: 'Order already received' });

      for (const item of po.items || []) {
        const product = products.find((entry: any) => String(entry._id) === String(item.productId) && String(entry.userId) === String(req.user.id));
        if (product) {
          product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
        }
      }

      po.status = 'Received';
      await writeLocalDb(payload);
      return res.json(po);
    }
    const po = await PurchaseOrder.findOne({ _id: req.params.id, userId: req.user.id });
    if (!po) return res.status(404).json({ message: 'Purchase Order not found' });
    if (po.status === 'Received') return res.status(400).json({ message: 'Order already received' });

    // Update stock levels
    for (const item of po.items) {
      await Product.findOneAndUpdate(
        { _id: item.productId, userId: req.user.id },
        { $inc: { stock: item.quantity } }
      );
    }

    po.status = 'Received';
    await po.save();
    res.json(po);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
