import express from 'express';
import { register, login } from '../controllers/authController';
import { getProducts, createProduct, updateProduct, deleteProduct, bulkCreateProducts } from '../controllers/productController';
import { getSales, createSale } from '../controllers/saleController';
import { getAnalyticsSummary } from '../controllers/analyticsController';
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../controllers/supplierController';
import { getExpenses, createExpense, updateExpense, deleteExpense } from '../controllers/expenseController';
import { getBusinessDocuments, createBusinessDocument, updateBusinessDocument, deleteBusinessDocument, convertDocumentToInvoice } from '../controllers/businessDocumentController';
import {
  getSyncStatus,
  pullFromGoogleDrive,
  pullToLocal,
  pushToGoogleDrive,
  pushToMongo,
  saveGoogleDriveConfig
} from '../controllers/syncController';
import { getPurchaseOrders, createPurchaseOrder, receivePurchaseOrder } from '../controllers/purchaseOrderController';
import { activateLicense, verifyLicense, getLicenses, generateLicense, updateLicenseStatus, deleteLicense } from '../controllers/licenseController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';
import userRoutes from './userRoutes';

const router = express.Router();

// Auth
router.post('/auth/register', register);
router.post('/auth/login', login);

// Users
router.use('/users', userRoutes);

// Products
router.get('/products', authMiddleware, getProducts);
router.post('/products', authMiddleware, adminMiddleware, createProduct);
router.post('/products/bulk', authMiddleware, adminMiddleware, bulkCreateProducts);
router.put('/products/:id', authMiddleware, adminMiddleware, updateProduct);
router.delete('/products/:id', authMiddleware, adminMiddleware, deleteProduct);

// Suppliers
router.get('/suppliers', authMiddleware, getSuppliers);
router.post('/suppliers', authMiddleware, adminMiddleware, createSupplier);
router.put('/suppliers/:id', authMiddleware, adminMiddleware, updateSupplier);
router.delete('/suppliers/:id', authMiddleware, adminMiddleware, deleteSupplier);

// Expenses
router.get('/expenses', authMiddleware, getExpenses);
router.post('/expenses', authMiddleware, adminMiddleware, createExpense);
router.put('/expenses/:id', authMiddleware, adminMiddleware, updateExpense);
router.delete('/expenses/:id', authMiddleware, adminMiddleware, deleteExpense);

// Business Documents (Quotes, Delivery Notes, Invoices)
router.get('/documents', authMiddleware, getBusinessDocuments);
router.post('/documents', authMiddleware, adminMiddleware, createBusinessDocument);
router.post('/documents/:id/convert-to-invoice', authMiddleware, adminMiddleware, convertDocumentToInvoice);
router.put('/documents/:id', authMiddleware, adminMiddleware, updateBusinessDocument);
router.delete('/documents/:id', authMiddleware, adminMiddleware, deleteBusinessDocument);

// Local DB Sync
router.get('/sync/status', authMiddleware, adminMiddleware, getSyncStatus);
router.post('/sync/pull', authMiddleware, adminMiddleware, pullToLocal);
router.post('/sync/push', authMiddleware, adminMiddleware, pushToMongo);
router.post('/sync/google-drive/config', authMiddleware, adminMiddleware, saveGoogleDriveConfig);
router.post('/sync/google-drive/push', authMiddleware, adminMiddleware, pushToGoogleDrive);
router.post('/sync/google-drive/pull', authMiddleware, adminMiddleware, pullFromGoogleDrive);

// Purchase Orders
router.get('/purchase-orders', authMiddleware, getPurchaseOrders);
router.post('/purchase-orders', authMiddleware, adminMiddleware, createPurchaseOrder);
router.post('/purchase-orders/:id/receive', authMiddleware, adminMiddleware, receivePurchaseOrder);
router.put('/purchase-orders/:id/receive', authMiddleware, adminMiddleware, receivePurchaseOrder);

// Sales
router.get('/sales', authMiddleware, getSales);
router.post('/sales', authMiddleware, createSale);

// Analytics
router.get('/analytics', authMiddleware, adminMiddleware, getAnalyticsSummary);

// Licensing
router.post('/license/activate', authMiddleware, activateLicense);
router.post('/license/verify', authMiddleware, verifyLicense);

// Admin Licensing Dashboard
router.get('/admin/licenses', authMiddleware, adminMiddleware, getLicenses);
router.post('/admin/licenses', authMiddleware, adminMiddleware, generateLicense);
router.put('/admin/licenses/:id', authMiddleware, adminMiddleware, updateLicenseStatus);
router.delete('/admin/licenses/:id', authMiddleware, adminMiddleware, deleteLicense);

export default router;
