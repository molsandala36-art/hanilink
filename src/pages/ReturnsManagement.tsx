import { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, PackageX, RotateCcw, Search } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';

interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

interface Sale {
  _id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

const ReturnsManagement = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await api.get('/sales');
        setSales(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchSales();
  }, []);

  const filteredSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sales;

    return sales.filter((sale) =>
      sale._id.toLowerCase().includes(term) ||
      sale.items.some((item) => item.name.toLowerCase().includes(term))
    );
  }, [sales, searchTerm]);

  const totals = useMemo(() => ({
    sales: sales.length,
    items: sales.reduce((sum, sale) => sum + sale.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0),
    revenue: sales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0),
  }), [sales]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <RotateCcw className="h-8 w-8 text-orange-500" />
            Gestion des retours
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Suivi des ventes récentes pour préparer les retours, échanges et remises en stock.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Ventes analysées" value={String(totals.sales)} icon={<ArrowLeftRight className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Articles vendus" value={String(totals.items)} icon={<PackageX className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Montant concerné" value={formatCurrency(totals.revenue)} icon={<RotateCcw className="h-5 w-5 text-orange-500" />} />
      </div>

      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
        Cette section est prête dans la navigation. Le prochain pas logique sera d’ajouter le traitement complet du retour:
        annulation partielle, remise en stock automatique et trace financière dédiée.
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Rechercher une vente ou un produit"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-6 py-4">Vente</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Articles</th>
                <th className="px-6 py-4">Paiement</th>
                <th className="px-6 py-4">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Chargement des ventes...
                  </td>
                </tr>
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Aucune vente trouvée.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale._id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">#{sale._id.slice(-8)}</p>
                      <p className="mt-1 text-xs text-gray-400">{sale._id}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(sale.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      <div className="space-y-1">
                        {sale.items.slice(0, 3).map((item, index) => (
                          <p key={`${sale._id}-${index}`}>
                            {item.name} x{item.quantity}
                          </p>
                        ))}
                        {sale.items.length > 3 ? (
                          <p className="text-xs text-gray-400">+{sale.items.length - 3} autres articles</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm capitalize text-gray-600 dark:text-gray-300">{sale.paymentMethod}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-orange-600 dark:text-orange-400">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className="rounded-2xl bg-orange-50 p-3 dark:bg-orange-900/20">{icon}</div>
    </div>
  </div>
);

export default ReturnsManagement;
