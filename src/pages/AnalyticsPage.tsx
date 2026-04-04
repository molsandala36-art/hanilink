import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, ShoppingBag, DollarSign, AlertTriangle, 
  ArrowUpRight, ArrowDownRight, Wallet
} from 'lucide-react';
import { motion } from 'motion/react';

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalSales: number;
    averageOrderValue: number;
    totalExpenses: number;
    netProfit: number;
  };
  dailyTrend: Array<{ _id: string; revenue: number; count: number }>;
  topProducts: Array<{ _id: string; name: string; totalQuantity: number; totalRevenue: number }>;
  lowStock: Array<{ _id: string; name: string; stock: number; price: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('/api/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setData(response.data);
      } catch (err) {
        setError('Failed to load analytics data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (error) return (
    <div className="p-6 text-center text-red-600">
      <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
      <p>{error}</p>
    </div>
  );

  if (!data) return null;

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics</h1>
        <div className="text-sm text-gray-500">Last 30 days overview</div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-50 rounded-xl">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <span className="flex items-center text-green-600 text-sm font-medium">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              12%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Total Revenue</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${data.summary.totalRevenue.toLocaleString()}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-50 rounded-xl">
              <ShoppingBag className="h-6 w-6 text-green-600" />
            </div>
            <span className="flex items-center text-green-600 text-sm font-medium">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              8%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Total Sales</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {data.summary.totalSales}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-50 rounded-xl">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <span className="flex items-center text-red-600 text-sm font-medium">
              <ArrowDownRight className="h-4 w-4 mr-1" />
              3%
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Avg. Order Value</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${data.summary.averageOrderValue.toFixed(2)}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-50 rounded-xl">
              <Wallet className="h-6 w-6 text-amber-600" />
            </div>
            <span className="flex items-center text-amber-600 text-sm font-medium">
              <ArrowUpRight className="h-4 w-4 mr-1" />
              Cost
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Total Expenses</h3>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${data.summary.totalExpenses.toLocaleString()}
          </p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
            <span className={`flex items-center text-sm font-medium ${data.summary.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {data.summary.netProfit >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
              Net
            </span>
          </div>
          <h3 className="text-gray-500 text-sm font-medium">Net Profit</h3>
          <p className={`text-2xl font-bold mt-1 ${data.summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            ${data.summary.netProfit.toLocaleString()}
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sales Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Revenue Trend (Last 7 Days)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Top Selling Products</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="totalQuantity" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Low Stock Alerts */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold">Inventory Alerts</h3>
            <span className="px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">ACTION REQUIRED</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <th className="pb-3">Product</th>
                  <th className="pb-3">Current Stock</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.lowStock.map((product) => (
                  <tr key={product._id}>
                    <td className="py-4 text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="py-4 text-sm text-gray-600">{product.stock} units</td>
                    <td className="py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        product.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                      }`}>
                        {product.stock === 0 ? 'Out of Stock' : 'Low Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.lowStock.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-gray-500 italic">No inventory alerts</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Revenue Distribution */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-6">Revenue Share</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.topProducts}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="totalRevenue"
                >
                  {data.topProducts.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {data.topProducts.map((product, index) => (
              <div key={product._id} className="flex items-center justify-between text-sm">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  <span className="text-gray-600 truncate max-w-[120px]">{product.name}</span>
                </div>
                <span className="font-medium">${product.totalRevenue.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
