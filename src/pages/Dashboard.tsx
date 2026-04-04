import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  DollarSign,
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
    { title: 'Ventes Totales', value: formatCurrency(stats.totalSales), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-100', adminOnly: true },
    { title: 'Produits', value: stats.productCount, icon: Package, color: 'text-blue-600', bg: 'bg-blue-100', adminOnly: false },
    { title: 'Commandes', value: stats.recentSales.length, icon: ShoppingCart, color: 'text-orange-600', bg: 'bg-orange-100', adminOnly: false },
    { title: 'Alertes Stock', value: stats.lowStockProducts.length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-100', adminOnly: false },
  ];

  const filteredCards = cards.filter(card => !card.adminOnly || isAdmin);

  if (loading) return <div className="flex items-center justify-center h-full dark:text-white">Chargement...</div>;

  return (
    <div className="space-y-8">
      {stats.lowStockProducts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4">
          <div className="bg-red-100 dark:bg-red-800 p-2 rounded-lg">
            <AlertTriangle className="text-red-600 dark:text-red-200 w-5 h-5" />
          </div>
          <div>
            <h4 className="text-red-800 dark:text-red-200 font-bold">Alertes de stock faible</h4>
            <p className="text-red-700 dark:text-red-300 text-sm mt-1">
              {stats.lowStockProducts.length} produit(s) ont un stock inférieur à 10 unités.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stats.lowStockProducts.slice(0, 3).map((p: any) => (
                <span key={p._id} className="bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 px-2 py-1 rounded text-xs font-bold">
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
          <div key={card.title} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className={`${card.bg} p-3 rounded-xl`}>
                <card.icon className={`${card.color} w-6 h-6`} />
              </div>
              <span className="flex items-center text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                <ArrowUpRight className="w-3 h-3 mr-1" />
                2.5%
              </span>
            </div>
            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">{card.title}</h3>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {isAdmin && (
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Aperçu des ventes</h3>
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
          "bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm",
          !isAdmin && "lg:col-span-4"
        )}>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Ventes récentes</h3>
          <div className="space-y-6">
            {stats.recentSales.map((sale: any) => (
              <div key={sale._id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
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
