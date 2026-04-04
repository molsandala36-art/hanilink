import { Request, Response } from 'express';
import Supplier from '../models/Supplier';
import { byUser, createLocalRecord, getCollection, readLocalDb, setCollection, sortByDateDesc, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

export const getSuppliers = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      return res.json(sortByDateDesc(byUser(getCollection(payload, 'suppliers'), req.user.id), 'createdAt'));
    }
    const suppliers = await Supplier.find({ userId: req.user.id });
    res.json(suppliers);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const createSupplier = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const suppliers = getCollection(payload, 'suppliers');
      const supplier = createLocalRecord({
        ...req.body,
        linkedProducts: req.body.linkedProducts || [],
        userId: req.user.id
      });
      suppliers.push(supplier);
      await writeLocalDb(payload);
      return res.status(201).json(supplier);
    }
    const supplier = new Supplier({
      ...req.body,
      userId: req.user.id,
    });
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateSupplier = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const suppliers = getCollection(payload, 'suppliers');
      const index = suppliers.findIndex((supplier: any) => String(supplier._id) === String(req.params.id) && String(supplier.userId) === String(req.user.id));
      if (index === -1) return res.status(404).json({ message: 'Supplier not found' });
      suppliers[index] = { ...suppliers[index], ...req.body };
      await writeLocalDb(payload);
      return res.json(suppliers[index]);
    }
    const supplier = await Supplier.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      req.body,
      { new: true }
    );
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json(supplier);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteSupplier = async (req: any, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const suppliers = getCollection(payload, 'suppliers');
      const nextSuppliers = suppliers.filter((supplier: any) => !(String(supplier._id) === String(req.params.id) && String(supplier.userId) === String(req.user.id)));
      if (nextSuppliers.length === suppliers.length) return res.status(404).json({ message: 'Supplier not found' });
      setCollection(payload, 'suppliers', nextSuppliers);
      await writeLocalDb(payload);
      return res.json({ message: 'Supplier deleted' });
    }
    const supplier = await Supplier.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
