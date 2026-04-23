import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import api from '../services/api';
import { formatCurrency, cn } from '../lib/utils';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalSales: 0,
    productCount: 0,
    recentSales: [],
    salesHistory: [],
    lowStockProducts: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsRes, salesRes] = await Promise.all([
          api.get('/products'),
          api.get('/sales')
        ]);

        const totalSales = salesRes.data.reduce((acc: number, sale: any) => acc + sale.totalAmount, 0);
        const lowStockProducts = productsRes.data.filter((p: any) => p.stock < 10);
        
        // Group sales by date for the chart
        const salesByDate = salesRes.data.reduce((acc: any, sale: any) => {
          const date = new Date(sale.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
          acc[date] = (acc[date] || 0) + sale.totalAmount;
          return acc;
        }, {});

        const salesHistory = Object.entries(salesByDate).map(([name, amount]) => ({ name, amount })).reverse().slice(-7);

        setStats({
          totalSales,
          productCount: productsRes.data.length,
          recentSales: salesRes.data.slice(0, 5),
          salesHistory,
          lowStockProducts
        });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  const cards = [
    { title: 'Ventes Totales', value: formatCurrency(stats.totalSales), icon: Wallet, color: 'text-green-600', bg: 'bg-green-100', adminOnly: true },
    { title: 'Produits', value: stats.productCount, icon: Package, color: 'text-blue-600', bg: 'bg-blue-100', adminOnly: false },
    { title: 'Commandes', value: stats.recentSales.length, icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-100', adminOnly: false },
    { title: 'Alertes Stock', value: stats.lowStockProducts.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', adminOnly: false },
  ];

  const filteredCards = cards.filter(card => !card.adminOnly || isAdmin);

  if (loading) return <div className="flex h-full items-center justify-center dark:text-white">Chargement...</div>;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 dark:text-white sm:text-3xl">
            Tableau de bord
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 sm:text-base">
            Vue d&apos;ensemble claire des ventes, du stock et de l&apos;activité récente.
          </p>
        </div>
      </div>
      {stats.lowStockProducts.length > 0 && (
        <div className="flex items-start gap-4 rounded-3xl border border-red-200 bg-red-50 p-4 shadow-sm animate-in fade-in slide-in-from-top-4 dark:border-red-800 dark:bg-red-900/20">
          <div className="rounded-2xl bg-red-100 p-2.5 dark:bg-red-800">
            <AlertTriangle className="text-red-600 dark:text-red-200 w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-black text-red-800 dark:text-red-200">Alertes de stock faible</h4>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              {stats.lowStockProducts.length} produit(s) ont un stock inférieur à 10 unités.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.lowStockProducts.slice(0, 3).map((p: any) => (
                <span key={p._id} className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 dark:bg-red-800 dark:text-red-200">
                  {p.name}: {p.stock}
                </span>
              ))}
              {stats.lowStockProducts.length > 3 && (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium self-center">
                  +{stats.lowStockProducts.length - 3} de plus
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filteredCards.map((card) => (
          <div key={card.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center justify-between mb-4">
              <div className={`${card.bg} rounded-2xl p-3`}>
                <card.icon className={`${card.color} w-6 h-6`} />
              </div>
              <span className="flex items-center rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-600 dark:bg-green-900/20">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                2.5%
              </span>
            </div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{card.title}</h3>
            <p className="mt-2 text-2xl font-black tracking-tight text-gray-900 dark:text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {isAdmin && (
          <div className="lg:col-span-2 rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h3 className="mb-6 text-lg font-black text-gray-900 dark:text-white">Aperçu des ventes</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.salesHistory}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} tickFormatter={(value) => `${value} DH`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: '#1f2937', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value: number) => [formatCurrency(value), 'Ventes']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className={cn(
          "rounded-3xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800",
          !isAdmin && "lg:col-span-4"
        )}>
          <h3 className="mb-6 text-lg font-black text-gray-900 dark:text-white">Ventes récentes</h3>
          <div className="space-y-6">
            {stats.recentSales.map((sale: any) => (
              <div key={sale._id} className="flex items-center justify-between gap-4 rounded-2xl bg-gray-50 px-4 py-3 dark:bg-gray-900/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white dark:bg-gray-700">
                    <ShoppingCart className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Commande #{sale._id.slice(-4)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(sale.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{formatCurrency(sale.totalAmount)}</span>
              </div>
            ))}
            {stats.recentSales.length === 0 && (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">Aucune vente pour le moment</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
