import express from 'express';
import { authMiddleware, adminMiddleware, AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { getCollection, readLocalDb, setCollection, useLocalDbStore, writeLocalDb } from '../services/localDataStore';

const router = express.Router();

// Get all users (Admin only)
router.get('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const users = getCollection(payload, 'users').map(({ password, ...user }: any) => user);
      return res.json(users);
    }
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const users = getCollection(payload, 'users');
      const user = users.find((entry: any) => String(entry._id) === String(req.params.id));
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (String(user._id) === String(req.user?.id)) {
        return res.status(400).json({ message: 'You cannot delete your own account' });
      }
      setCollection(payload, 'users', users.filter((entry: any) => String(entry._id) !== String(req.params.id)));
      await writeLocalDb(payload);
      return res.json({ message: 'User deleted' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting self
    if (user._id.toString() === req.user?.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    await user.deleteOne();
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user role (Admin only)
router.put('/:id/role', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const users = getCollection(payload, 'users');
      const user = users.find((entry: any) => String(entry._id) === String(req.params.id));
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (String(user._id) === String(req.user?.id)) {
        return res.status(400).json({ message: 'You cannot change your own role' });
      }
      user.role = req.body.role;
      await writeLocalDb(payload);
      return res.json({ message: 'User role updated' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Prevent changing own role
    if (user._id.toString() === req.user?.id) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    user.role = req.body.role;
    await user.save();
    res.json({ message: 'User role updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user details (Admin or self)
router.put('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (useLocalDbStore()) {
      const payload = await readLocalDb();
      const users = getCollection(payload, 'users');
      const user = users.find((entry: any) => String(entry._id) === String(req.params.id));
      if (!user) return res.status(404).json({ message: 'User not found' });
      if (req.user?.role !== 'admin' && String(user._id) !== String(req.user?.id)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const { name, email, shopName, ice, if: ifField, rc, address } = req.body;
      if (name) user.name = name;
      if (email) user.email = email;
      if (shopName) user.shopName = shopName;
      if (ice !== undefined) user.ice = ice;
      if (ifField !== undefined) user.if = ifField;
      if (rc !== undefined) user.rc = rc;
      if (address !== undefined) user.address = address;

      await writeLocalDb(payload);
      return res.json({ message: 'User updated' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Check if admin or self
    if (req.user?.role !== 'admin' && user._id.toString() !== req.user?.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { name, email, shopName, ice, if: ifField, rc, address } = req.body;
    
    if (name) user.name = name;
    if (email) user.email = email;
    if (shopName) user.shopName = shopName;
    if (ice !== undefined) user.ice = ice;
    if (ifField !== undefined) user.if = ifField;
    if (rc !== undefined) user.rc = rc;
    if (address !== undefined) user.address = address;

    await user.save();
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
