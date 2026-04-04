import { Request, Response } from 'express';
import Sale from '../models/Sale';
import Product from '../models/Product';
import { byUser, getCollection, readLocalDb, useLocalDbStore } from '../services/localDataStore';

export const getAnalyticsSummary = async (req: Request, res: Response) => {
  try {
    if (useLocalDbStore()) {
      const userId = (req as any).user?.id;
      const payload = await readLocalDb();
      const sales = byUser(getCollection(payload, 'sales'), userId);
      const products = byUser(getCollection(payload, 'products'), userId);
      const expenses = byUser(getCollection(payload, 'expenses'), userId);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentSales = sales.filter((sale: any) => new Date(sale.createdAt).getTime() >= thirtyDaysAgo.getTime());
      const recentExpenses = expenses.filter((expense: any) => new Date(expense.expenseDate || expense.createdAt).getTime() >= thirtyDaysAgo.getTime());
      const totalRevenue = recentSales.reduce((sum: number, sale: any) => sum + Number(sale.totalAmount || 0), 0);
      const totalSales = recentSales.length;
      const averageOrderValue = totalSales ? totalRevenue / totalSales : 0;
      const totalExpenses = recentExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);

      const trendMap = new Map<string, { _id: string; revenue: number; count: number }>();
      for (const sale of recentSales.filter((entry: any) => new Date(entry.createdAt).getTime() >= sevenDaysAgo.getTime())) {
        const key = new Date(sale.createdAt).toISOString().slice(0, 10);
        const current = trendMap.get(key) || { _id: key, revenue: 0, count: 0 };
        current.revenue += Number(sale.totalAmount || 0);
        current.count += 1;
        trendMap.set(key, current);
      }

      const topProductMap = new Map<string, { _id: string; name: string; totalQuantity: number; totalRevenue: number }>();
      for (const sale of sales) {
        for (const item of sale.items || []) {
          const id = String(item.productId);
          const current = topProductMap.get(id) || { _id: id, name: item.name, totalQuantity: 0, totalRevenue: 0 };
          current.totalQuantity += Number(item.quantity || 0);
          current.totalRevenue += Number(item.quantity || 0) * Number(item.price || 0);
          topProductMap.set(id, current);
        }
      }

      const lowStock = products.filter((product: any) => Number(product.stock || 0) < 10).slice(0, 5);

      return res.json({
        summary: {
          totalRevenue,
          totalSales,
          averageOrderValue,
          totalExpenses,
          netProfit: totalRevenue - totalExpenses
        },
        dailyTrend: Array.from(trendMap.values()).sort((a, b) => a._id.localeCompare(b._id)),
        topProducts: Array.from(topProductMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity).slice(0, 5),
        lowStock
      });
    }
    // 1. Total Sales and Revenue (Last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const salesStats = await Sale.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          totalSales: { $count: {} },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // 1-bis. Expense and profit estimate based on product purchase price x sold quantity
    const expenseStats = await Sale.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      { $unwind: '$items' },
      {
        $lookup: {
          from: 'products',
          localField: 'items.productId',
          foreignField: '_id',
          as: 'product'
        }
      },
      {
        $project: {
          quantity: '$items.quantity',
          unitExpense: {
            $ifNull: [{ $arrayElemAt: ['$product.purchasePrice', 0] }, 0]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalExpenses: { $sum: { $multiply: ['$quantity', '$unitExpense'] } }
        }
      }
    ]);

    // 2. Sales Trends (Last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyTrend = await Sale.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          count: { $count: {} }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // 3. Top Selling Products
    const topProducts = await Sale.aggregate([
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
        }
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 }
    ]);

    // 4. Low Stock Alert
    const lowStock = await Product.find({ stock: { $lt: 10 } }).limit(5);

    const summary = salesStats[0] || { totalRevenue: 0, totalSales: 0, averageOrderValue: 0 };
    const totalExpenses = expenseStats[0]?.totalExpenses || 0;

    res.json({
      summary: {
        ...summary,
        totalExpenses,
        netProfit: summary.totalRevenue - totalExpenses
      },
      dailyTrend,
      topProducts,
      lowStock
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
};
