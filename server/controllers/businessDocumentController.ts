import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import BusinessDocument, { BusinessDocumentType } from '../models/BusinessDocument';
import { byUser, createLocalRecord, getCollection, readLocalDb, setCollection, sortByDateDesc, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

const TYPE_PREFIX: Record<BusinessDocumentType, string> = {
  quote: 'DEV',
  delivery_note: 'BL',
  invoice: 'FAC'
};

const toNumber = (value: any) => Number(value || 0);

const computeTotals = (items: any[], taxRate: number) => {
  const normalizedItems = (items || []).map((item) => {
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unitPrice);
    return {
      description: String(item.description || '').trim(),
      quantity,
      unitPrice,
      lineTotal: quantity * unitPrice
    };
  }).filter((item) => item.description && item.quantity > 0);

  const subtotal = normalizedItems.reduce((acc, item) => acc + item.lineTotal, 0);
  const taxAmount = subtotal * (toNumber(taxRate) / 100);
  const totalAmount = subtotal + taxAmount;

  return { normalizedItems, subtotal, taxAmount, totalAmount };
};

const generateNumber = (type: BusinessDocumentType) => {
  const prefix = TYPE_PREFIX[type];
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${ymd}-${rand}`;
};

export const getBusinessDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const type = req.query.type as BusinessDocumentType | undefined;
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      let docs = byUser(getCollection(payload, 'businessDocuments'), req.user?.id);
      if (type && ['quote', 'delivery_note', 'invoice'].includes(type)) {
        docs = docs.filter((doc: any) => doc.documentType === type);
      }
      return res.json(sortByDateDesc(docs, 'issueDate', 'createdAt'));
    }
    const filter: any = { userId: req.user?.id };
    if (type && ['quote', 'delivery_note', 'invoice'].includes(type)) {
      filter.documentType = type;
    }

    const docs = await BusinessDocument.find(filter).sort({ issueDate: -1, createdAt: -1 });
    res.json(docs);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to fetch documents' });
  }
};

export const createBusinessDocument = async (req: AuthRequest, res: Response) => {
  try {
    const {
      documentType,
      customerName,
      customerPhone,
      customerAddress,
      issueDate,
      dueDate,
      status,
      items,
      notes,
      taxRate
    } = req.body;

    if (!['quote', 'delivery_note', 'invoice'].includes(documentType)) {
      return res.status(400).json({ message: 'Invalid document type' });
    }

    const { normalizedItems, subtotal, taxAmount, totalAmount } = computeTotals(items, taxRate);
    if (!customerName || normalizedItems.length === 0) {
      return res.status(400).json({ message: 'Customer name and at least one item are required' });
    }

    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const docs = getCollection(payload, 'businessDocuments');
      const doc = createLocalRecord({
        documentType,
        documentNumber: generateNumber(documentType),
        customerName,
        customerPhone,
        customerAddress,
        issueDate,
        dueDate,
        status: status || 'draft',
        items: normalizedItems,
        subtotal,
        taxAmount,
        totalAmount,
        notes,
        userId: req.user?.id
      });
      docs.push(doc);
      await writeLocalDb(payload);
      return res.status(201).json(doc);
    }

    const doc = new BusinessDocument({
      documentType,
      documentNumber: generateNumber(documentType),
      customerName,
      customerPhone,
      customerAddress,
      issueDate,
      dueDate,
      status: status || 'draft',
      items: normalizedItems,
      subtotal,
      taxAmount,
      totalAmount,
      notes,
      userId: req.user?.id
    });

    await doc.save();
    res.status(201).json(doc);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to create document' });
  }
};

export const updateBusinessDocument = async (req: AuthRequest, res: Response) => {
  try {
    const {
      customerName,
      customerPhone,
      customerAddress,
      issueDate,
      dueDate,
      status,
      items,
      notes,
      taxRate
    } = req.body;

    const { normalizedItems, subtotal, taxAmount, totalAmount } = computeTotals(items, taxRate);
    if (!customerName || normalizedItems.length === 0) {
      return res.status(400).json({ message: 'Customer name and at least one item are required' });
    }

    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const docs = getCollection(payload, 'businessDocuments');
      const index = docs.findIndex((doc: any) => String(doc._id) === String(req.params.id) && String(doc.userId) === String(req.user?.id));
      if (index === -1) {
        return res.status(404).json({ message: 'Document not found' });
      }
      docs[index] = {
        ...docs[index],
        customerName,
        customerPhone,
        customerAddress,
        issueDate,
        dueDate,
        status,
        items: normalizedItems,
        subtotal,
        taxAmount,
        totalAmount,
        notes
      };
      await writeLocalDb(payload);
      return res.json(docs[index]);
    }

    const updated = await BusinessDocument.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id },
      {
        customerName,
        customerPhone,
        customerAddress,
        issueDate,
        dueDate,
        status,
        items: normalizedItems,
        subtotal,
        taxAmount,
        totalAmount,
        notes
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: 'Document not found' });
    }

    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ message: error.message || 'Failed to update document' });
  }
};

export const deleteBusinessDocument = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const docs = getCollection(payload, 'businessDocuments');
      const nextDocs = docs.filter((doc: any) => !(String(doc._id) === String(req.params.id) && String(doc.userId) === String(req.user?.id)));
      if (nextDocs.length === docs.length) {
        return res.status(404).json({ message: 'Document not found' });
      }
      setCollection(payload, 'businessDocuments', nextDocs);
      await writeLocalDb(payload);
      return res.json({ message: 'Document deleted' });
    }
    const deleted = await BusinessDocument.findOneAndDelete({ _id: req.params.id, userId: req.user?.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Document not found' });
    }
    res.json({ message: 'Document deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete document' });
  }
};

export const convertDocumentToInvoice = async (req: AuthRequest, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const docs = getCollection(payload, 'businessDocuments');
      const source = docs.find((doc: any) => String(doc._id) === String(req.params.id) && String(doc.userId) === String(req.user?.id));
      if (!source) {
        return res.status(404).json({ message: 'Document not found' });
      }

      if (!['quote', 'delivery_note'].includes(source.documentType)) {
        return res.status(400).json({ message: 'Only quote and delivery note can be converted to invoice' });
      }

      const invoice = createLocalRecord({
        documentType: 'invoice',
        documentNumber: generateNumber('invoice'),
        sourceDocumentId: source._id,
        sourceDocumentType: source.documentType,
        customerName: source.customerName,
        customerPhone: source.customerPhone,
        customerAddress: source.customerAddress,
        issueDate: new Date().toISOString(),
        dueDate: source.dueDate,
        status: 'draft',
        items: source.items,
        subtotal: source.subtotal,
        taxAmount: source.taxAmount,
        totalAmount: source.totalAmount,
        notes: source.notes,
        userId: req.user?.id
      });

      docs.push(invoice);
      await writeLocalDb(payload);
      return res.status(201).json(invoice);
    }
    const source = await BusinessDocument.findOne({ _id: req.params.id, userId: req.user?.id });
    if (!source) {
      return res.status(404).json({ message: 'Document not found' });
    }

    if (!['quote', 'delivery_note'].includes(source.documentType)) {
      return res.status(400).json({ message: 'Only quote and delivery note can be converted to invoice' });
    }

    const invoice = new BusinessDocument({
      documentType: 'invoice',
      documentNumber: generateNumber('invoice'),
      sourceDocumentId: source._id,
      sourceDocumentType: source.documentType,
      customerName: source.customerName,
      customerPhone: source.customerPhone,
      customerAddress: source.customerAddress,
      issueDate: new Date(),
      dueDate: source.dueDate,
      status: 'draft',
      items: source.items,
      subtotal: source.subtotal,
      taxAmount: source.taxAmount,
      totalAmount: source.totalAmount,
      notes: source.notes,
      userId: req.user?.id
    });

    await invoice.save();
    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to convert document to invoice' });
  }
};
