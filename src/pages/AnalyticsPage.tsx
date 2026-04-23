import React, { useEffect, useState } from 'react';
import api from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  ShoppingBag,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { formatCurrency } from '../lib/utils';

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalSales: number;
    averageOrderValue: number;
    totalExpenses: number;
    totalCostOfGoods?: number;
    totalOperationalCosts?: number;
    netProfit: number;
  };
  dailyTrend: Array<{ _id: string; revenue: number; count: number }>;
  topProducts: Array<{ _id: string; name: string; totalQuantity: number; totalRevenue: number }>;
  lowStock: Array<{ _id: string; name: string; stock: number; price: number }>;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#f97316'];

const cardClass =
  'rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800';

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await api.get('/analytics');
        setData(response.data);
      } catch (err) {
        setError('Impossible de charger les analyses.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-center text-red-600 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
        <AlertTriangle className="mx-auto mb-4 h-12 w-12" />
        <p>{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const summaryCards = [
    {
      title: "Chiffre d'affaires",
      value: formatCurrency(data.summary.totalRevenue),
      icon: Wallet,
      tone: 'blue',
      trend: '12%',
      positive: true,
    },
    {
      title: 'Ventes totales',
      value: String(data.summary.totalSales),
      icon: ShoppingBag,
      tone: 'green',
      trend: '8%',
      positive: true,
    },
    {
      title: 'Panier moyen',
      value: formatCurrency(data.summary.averageOrderValue),
      icon: TrendingUp,
      tone: 'purple',
      trend: '3%',
      positive: false,
    },
    {
      title: 'Charges totales',
      value: formatCurrency(data.summary.totalExpenses),
      icon: Wallet,
      tone: 'amber',
      trend: 'Charges',
      positive: true,
    },
    {
      title: "Coût d'achat",
      value: formatCurrency(data.summary.totalCostOfGoods || 0),
      icon: ShoppingBag,
      tone: 'rose',
      trend: 'Achats',
      positive: false,
    },
    {
      title: 'Bénéfice net',
      value: formatCurrency(data.summary.netProfit),
      icon: TrendingUp,
      tone: data.summary.netProfit >= 0 ? 'emerald' : 'red',
      trend: 'Net',
      positive: data.summary.netProfit >= 0,
    },
  ];

  const toneMap: Record<string, { iconBg: string; iconColor: string; trendText: string; trendBg: string }> = {
    blue: { iconBg: 'bg-blue-50 dark:bg-blue-900/20', iconColor: 'text-blue-600 dark:text-blue-300', trendText: 'text-blue-600', trendBg: 'bg-blue-50 dark:bg-blue-900/20' },
    green: { iconBg: 'bg-green-50 dark:bg-green-900/20', iconColor: 'text-green-600 dark:text-green-300', trendText: 'text-green-600', trendBg: 'bg-green-50 dark:bg-green-900/20' },
    purple: { iconBg: 'bg-purple-50 dark:bg-purple-900/20', iconColor: 'text-purple-600 dark:text-purple-300', trendText: 'text-purple-600', trendBg: 'bg-purple-50 dark:bg-purple-900/20' },
    amber: { iconBg: 'bg-amber-50 dark:bg-amber-900/20', iconColor: 'text-amber-600 dark:text-amber-300', trendText: 'text-amber-600', trendBg: 'bg-amber-50 dark:bg-amber-900/20' },
    rose: { iconBg: 'bg-rose-50 dark:bg-rose-900/20', iconColor: 'text-rose-600 dark:text-rose-300', trendText: 'text-rose-600', trendBg: 'bg-rose-50 dark:bg-rose-900/20' },
    emerald: { iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-600 dark:text-emerald-300', trendText: 'text-emerald-600', trendBg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    red: { iconBg: 'bg-red-50 dark:bg-red-900/20', iconColor: 'text-red-600 dark:text-red-300', trendText: 'text-red-600', trendBg: 'bg-red-50 dark:bg-red-900/20' },
  };

  return (
    <div className="space-y-6 p-4 sm:space-y-8 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Analyses avancées
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Vue structurée des ventes, coûts et performances sur les 30 derniers jours.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          const tone = toneMap[card.tone];
          const TrendIcon = card.positive ? ArrowUpRight : ArrowDownRight;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cardClass}
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className={`rounded-2xl p-3 ${tone.iconBg}`}>
                  <Icon className={`h-6 w-6 ${tone.iconColor}`} />
                </div>
                <span className={`flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${tone.trendBg} ${tone.trendText}`}>
                  <TrendIcon className="mr-1 h-3 w-3" />
                  {card.trend}
                </span>
              </div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {card.title}
              </h3>
              <p className={`mt-2 text-2xl font-black tracking-tight ${card.tone === 'red' ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                {card.value}
              </p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className={cardClass}>
          <h3 className="mb-6 text-lg font-black text-gray-900 dark:text-white">Tendance du chiffre d&apos;affaires</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="_id" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(value) => formatCurrency(Number(value)).replace(',00', '')}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)' }}
                  formatter={(value: number) => [formatCurrency(value), "Chiffre d'affaires"]}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#f97316' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="mb-6 text-lg font-black text-gray-900 dark:text-white">Produits les plus vendus</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 12px 24px rgba(15, 23, 42, 0.12)' }}
                  formatter={(value: number) => [`${value}`, 'Quantité']}
                />
                <Bar dataKey="totalQuantity" fill="#10b981" radius={[0, 10, 10, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className={`lg:col-span-2 ${cardClass}`}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-black text-gray-900 dark:text-white">Alertes de stock</h3>
            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600 dark:bg-red-900/20 dark:text-red-300">
              Action requise
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  <th className="pb-3">Produit</th>
                  <th className="pb-3">Stock actuel</th>
                  <th className="pb-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/60">
                {data.lowStock.map((product) => (
                  <tr key={product._id}>
                    <td className="py-4 text-sm font-semibold text-gray-900 dark:text-white">{product.name}</td>
                    <td className="py-4 text-sm text-gray-600 dark:text-gray-300">{product.stock} unités</td>
                    <td className="py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        product.stock === 0
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300'
                      }`}>
                        {product.stock === 0 ? 'Rupture' : 'Stock faible'}
                      </span>
                    </td>
                  </tr>
                ))}
                {data.lowStock.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-sm italic text-gray-500 dark:text-gray-400">
                      Aucun produit en alerte.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="mb-6 text-lg font-black text-gray-900 dark:text-white">Répartition du revenu</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.topProducts}
                  cx="50%"
                  cy="50%"
                  innerRadius={58}
                  outerRadius={82}
                  paddingAngle={4}
                  dataKey="totalRevenue"
                >
                  {data.topProducts.map((entry, index) => (
                    <Cell key={`cell-${entry._id}-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [formatCurrency(value), 'Revenu']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {data.topProducts.map((product, index) => (
              <div key={product._id} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex min-w-0 items-center">
                  <div className="mr-2 h-3 w-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="truncate text-gray-600 dark:text-gray-300">{product.name}</span>
                </div>
                <span className="font-bold text-gray-900 dark:text-white">{formatCurrency(product.totalRevenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPage;
