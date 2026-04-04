import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Product from '../models/Product';
import { byUser, createLocalRecord, getCollection, readLocalDb, setCollection, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

export const getProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      return res.json(byUser(getCollection(payload, 'products'), req.user?.id));
    }
    const products = await Product.find({ userId: req.user?.id });
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const createProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      name, 
      price, 
      purchasePrice, 
      stock, 
      category, 
      tvaRate, 
      supplierTva, 
      place, 
      photoUrl,
      supplierId
    } = req.body;

    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const products = getCollection(payload, 'products');
      const product = createLocalRecord({
        name,
        price: Number(price),
        purchasePrice: Number(purchasePrice || 0),
        stock: Number(stock),
        category,
        tvaRate: Number(tvaRate || 20),
        supplierTva: Number(supplierTva || 20),
        place,
        photoUrl,
        supplierId: supplierId || '',
        userId: req.user?.id
      });
      products.push(product);
      await writeLocalDb(payload);
      return res.json(product);
    }
    
    const product = new Product({
      name,
      price,
      purchasePrice,
      stock,
      category,
      tvaRate,
      supplierTva,
      place,
      photoUrl,
      supplierId,
      userId: req.user?.id
    });
    await product.save();
    res.json(product);
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export const bulkCreateProducts = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const products = getCollection(payload, 'products');
      const created = req.body.map((p: any) =>
        createLocalRecord({
          ...p,
          price: Number(p.price),
          purchasePrice: Number(p.purchasePrice || 0),
          stock: Number(p.stock),
          tvaRate: Number(p.tvaRate || 20),
          supplierTva: Number(p.supplierTva || 20),
          supplierId: p.supplierId || '',
          userId: req.user?.id
        })
      );
      products.push(...created);
      await writeLocalDb(payload);
      return res.json(created);
    }
    const productsData = req.body.map((p: any) => ({
      ...p,
      userId: req.user?.id
    }));
    const products = await Product.insertMany(productsData);
    res.json(products);
  } catch (err) {
    console.error('Bulk create error:', err);
    res.status(500).json({ message: 'Server error during bulk import' });
  }
};

export const updateProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const products = getCollection(payload, 'products');
      const index = products.findIndex((product: any) => String(product._id) === String(id) && String(product.userId) === String(req.user?.id));
      if (index === -1) return res.status(404).json({ message: 'Product not found' });
      products[index] = {
        ...products[index],
        ...req.body,
        price: Number(req.body.price ?? products[index].price),
        purchasePrice: Number(req.body.purchasePrice ?? products[index].purchasePrice ?? 0),
        stock: Number(req.body.stock ?? products[index].stock),
        tvaRate: Number(req.body.tvaRate ?? products[index].tvaRate ?? 20),
        supplierTva: Number(req.body.supplierTva ?? products[index].supplierTva ?? 20)
      };
      await writeLocalDb(payload);
      return res.json(products[index]);
    }
    const product = await Product.findOneAndUpdate(
      { _id: id, userId: req.user?.id },
      req.body,
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteProduct = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const products = getCollection(payload, 'products');
      const nextProducts = products.filter((product: any) => !(String(product._id) === String(id) && String(product.userId) === String(req.user?.id)));
      if (nextProducts.length === products.length) return res.status(404).json({ message: 'Product not found' });
      setCollection(payload, 'products', nextProducts);
      await writeLocalDb(payload);
      return res.json({ message: 'Product deleted' });
    }
    const product = await Product.findOneAndDelete({ _id: id, userId: req.user?.id });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};
