import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Loader2,
  PackageX,
  RotateCcw,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';

interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  purchasePrice?: number;
  tvaRate?: number;
}

interface Sale {
  _id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

interface ReturnItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

interface ReturnEntry {
  _id: string;
  saleId: string;
  items: ReturnItem[];
  totalAmount: number;
  refundMethod: string;
  reason: string;
  notes: string;
  restocked: boolean;
  createdAt: string;
}

interface ReturnDraftLine {
  productId: string;
  name: string;
  soldQuantity: number;
  alreadyReturned: number;
  returnQuantity: number;
  price: number;
  tvaRate: number;
}

const ReturnsManagement = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<ReturnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnLines, setReturnLines] = useState<ReturnDraftLine[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState<'cash' | 'card' | 'cmi'>('cash');
  const [restocked, setRestocked] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesRes, returnsRes] = await Promise.all([api.get('/sales'), api.get('/returns')]);
      setSales(Array.isArray(salesRes.data) ? salesRes.data : []);
      setReturns(Array.isArray(returnsRes.data) ? returnsRes.data : []);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'Impossible de charger les retours.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const returnedBySale = useMemo(() => {
    const map = new Map<string, Map<string, number>>();

    returns.forEach((entry) => {
      const perProduct = map.get(entry.saleId) || new Map<string, number>();
      entry.items.forEach((item) => {
        const productId = String(item.productId || '').trim();
        if (!productId) return;
        perProduct.set(productId, (perProduct.get(productId) || 0) + Number(item.quantity || 0));
      });
      map.set(entry.saleId, perProduct);
    });

    return map;
  }, [returns]);

  const filteredSales = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return sales;

    return sales.filter((sale) =>
      sale._id.toLowerCase().includes(term) ||
      sale.items.some((item) => item.name.toLowerCase().includes(term))
    );
  }, [sales, searchTerm]);

  const totals = useMemo(
    () => ({
      returns: returns.length,
      refundedAmount: returns.reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0),
      restockedItems: returns.reduce(
        (sum, entry) => sum + entry.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
        0
      ),
    }),
    [returns]
  );

  const openReturnModal = (sale: Sale) => {
    const alreadyReturned = returnedBySale.get(sale._id) || new Map<string, number>();
    const draft = sale.items.map((item) => ({
      productId: item.productId,
      name: item.name,
      soldQuantity: Number(item.quantity || 0),
      alreadyReturned: alreadyReturned.get(item.productId) || 0,
      returnQuantity: 0,
      price: Number(item.price || 0),
      tvaRate: Number(item.tvaRate || 20),
    }));

    setSelectedSale(sale);
    setReturnLines(draft);
    setReason('');
    setNotes('');
    setRefundMethod((sale.paymentMethod as 'cash' | 'card' | 'cmi') || 'cash');
    setRestocked(true);
    setError('');
    setSuccess('');
  };

  const closeReturnModal = () => {
    setSelectedSale(null);
    setReturnLines([]);
    setReason('');
    setNotes('');
    setError('');
  };

  const updateReturnQuantity = (productId: string, quantity: number) => {
    setReturnLines((current) =>
      current.map((line) => {
        if (line.productId !== productId) return line;
        const remaining = Math.max(line.soldQuantity - line.alreadyReturned, 0);
        const safeQuantity = Math.min(Math.max(quantity, 0), remaining);
        return { ...line, returnQuantity: safeQuantity };
      })
    );
  };

  const selectedItems = useMemo(
    () => returnLines.filter((line) => Number(line.returnQuantity || 0) > 0),
    [returnLines]
  );

  const returnTotals = useMemo(() => {
    const subtotal = selectedItems.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.returnQuantity || 0), 0);
    const tva = selectedItems.reduce(
      (sum, line) => sum + Number(line.price || 0) * Number(line.returnQuantity || 0) * (Number(line.tvaRate || 0) / 100),
      0
    );
    return {
      subtotal,
      tva,
      total: subtotal + tva,
    };
  }, [selectedItems]);

  const createReturn = async () => {
    if (!selectedSale) return;
    if (selectedItems.length === 0) {
      setError('Selectionne au moins un article a retourner.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        saleId: selectedSale._id,
        refundMethod,
        reason,
        notes,
        restocked,
        items: selectedItems.map((line) => ({
          productId: line.productId,
          quantity: line.returnQuantity,
        })),
      };

      await api.post('/returns', payload);
      setSuccess('Retour enregistre avec succes.');
      await fetchData();
      closeReturnModal();
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.message || 'Impossible d’enregistrer le retour.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <RotateCcw className="h-8 w-8 text-orange-500" />
            Gestion des retours
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Gère les retours partiels, la remise en stock et la trace financière dédiée.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/20 dark:text-green-200">
          {success}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Retours enregistrés" value={String(totals.returns)} icon={<ArrowLeftRight className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Montant remboursé" value={formatCurrency(totals.refundedAmount)} icon={<Undo2 className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Articles réintégrés" value={String(totals.restockedItems)} icon={<PackageX className="h-5 w-5 text-orange-500" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <section className="space-y-4">
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
            <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Ventes éligibles au retour</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[840px]">
                <thead className="bg-gray-50 dark:bg-gray-800/60">
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    <th className="px-6 py-4">Vente</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Articles</th>
                    <th className="px-6 py-4">Montant</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
                      </td>
                    </tr>
                  ) : filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                        Aucune vente trouvée.
                      </td>
                    </tr>
                  ) : (
                    filteredSales.map((sale) => {
                      const returned = returnedBySale.get(sale._id) || new Map<string, number>();
                      const hasRemaining = sale.items.some(
                        (item) => Number(item.quantity || 0) - Number(returned.get(item.productId) || 0) > 0
                      );

                      return (
                        <tr key={sale._id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900 dark:text-white">#{sale._id.slice(-8)}</p>
                            <p className="mt-1 text-xs text-gray-400">{sale._id}</p>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{formatDate(sale.createdAt)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                            <div className="space-y-1">
                              {sale.items.slice(0, 3).map((item, index) => {
                                const alreadyReturned = Number(returned.get(item.productId) || 0);
                                const remaining = Number(item.quantity || 0) - alreadyReturned;
                                return (
                                  <p key={`${sale._id}-${index}`}>
                                    {item.name} x{item.quantity}
                                    {alreadyReturned > 0 ? (
                                      <span className="ml-2 text-xs text-orange-500">reste {Math.max(remaining, 0)}</span>
                                    ) : null}
                                  </p>
                                );
                              })}
                              {sale.items.length > 3 ? (
                                <p className="text-xs text-gray-400">+{sale.items.length - 3} autres articles</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {formatCurrency(sale.totalAmount)}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              disabled={!hasRemaining}
                              onClick={() => openReturnModal(sale)}
                              className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                            >
                              Nouveau retour
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Trace financière des retours</h2>
          </div>
          <div className="max-h-[42rem] overflow-auto">
            {loading ? (
              <div className="px-6 py-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : returns.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                Aucun retour enregistré.
              </div>
            ) : (
              <div className="space-y-4 p-4">
                {returns.map((entry) => (
                  <div
                    key={entry._id}
                    className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">Retour #{entry._id.slice(-8)}</p>
                        <p className="mt-1 text-xs text-gray-400">Vente source #{entry.saleId.slice(-8)}</p>
                      </div>
                      <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                        {formatCurrency(entry.totalAmount)}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      {entry.items.map((item, index) => (
                        <p key={`${entry._id}-${index}`}>
                          {item.name} x{item.quantity}
                        </p>
                      ))}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-white px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {entry.refundMethod}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 ${
                          entry.restocked
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}
                      >
                        {entry.restocked ? 'stock remis à jour' : 'sans remise en stock'}
                      </span>
                      <span className="rounded-full bg-white px-3 py-1 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        {formatDate(entry.createdAt)}
                      </span>
                    </div>
                    {entry.reason || entry.notes ? (
                      <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                        {[entry.reason, entry.notes].filter(Boolean).join(' • ')}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-gray-900"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5 dark:border-gray-800">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Créer un retour</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Vente source #{selectedSale._id.slice(-8)} • {formatDate(selectedSale.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeReturnModal}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid max-h-[calc(90vh-5rem)] gap-6 overflow-auto p-6 xl:grid-cols-[1.2fr,0.8fr]">
              <div className="space-y-4">
                {returnLines.map((line) => {
                  const remaining = Math.max(line.soldQuantity - line.alreadyReturned, 0);
                  return (
                    <div
                      key={line.productId}
                      className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{line.name}</p>
                          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Vendu: {line.soldQuantity} • Déjà retourné: {line.alreadyReturned} • Disponible: {remaining}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="min-w-[6rem] text-right text-sm font-semibold text-orange-600 dark:text-orange-400">
                            {formatCurrency(line.price)}
                          </span>
                          <input
                            type="number"
                            min="0"
                            max={remaining}
                            value={line.returnQuantity}
                            onChange={(event) => updateReturnQuantity(line.productId, Number(event.target.value || 0))}
                            className="w-24 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Motif du retour</label>
                  <input
                    type="text"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Produit abîmé, erreur caisse, échange..."
                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Commentaires internes sur le retour"
                    className="mt-2 h-28 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950/40">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mode de remboursement</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'cmi'] as const).map((method) => (
                      <button
                        key={method}
                        type="button"
                        onClick={() => setRefundMethod(method)}
                        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                          refundMethod === method
                            ? 'bg-orange-500 text-white'
                            : 'bg-white text-gray-600 hover:bg-orange-50 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                        }`}
                      >
                        {method.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <label className="mt-4 flex items-start gap-3 rounded-xl border border-orange-100 bg-orange-50 p-3 text-sm text-orange-900 dark:border-orange-900/30 dark:bg-orange-950/20 dark:text-orange-200">
                    <input
                      type="checkbox"
                      checked={restocked}
                      onChange={(event) => setRestocked(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>Remettre automatiquement les quantités retournées dans le stock.</span>
                  </label>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950/40">
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>Total HT</span>
                    <span>{formatCurrency(returnTotals.subtotal)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <span>TVA</span>
                    <span>{formatCurrency(returnTotals.tva)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-lg font-bold text-gray-900 dark:text-white">
                    <span>Total retour</span>
                    <span className="text-orange-600 dark:text-orange-400">{formatCurrency(returnTotals.total)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeReturnModal}
                    className="flex-1 rounded-xl border border-gray-200 px-4 py-3 font-semibold text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={submitting || selectedItems.length === 0}
                    onClick={() => void createReturn()}
                    className="flex-1 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {submitting ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Enregistrement...
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Valider le retour
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
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
