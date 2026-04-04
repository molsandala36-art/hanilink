import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ClipboardList, Plus, Search, Trash2, Edit2, Loader2, AlertCircle, CheckCircle2, Package, Truck, Calendar, X, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { translations, Language } from '../lib/translations';

const getEmptyFormData = () => ({
  supplierId: '',
  items: [] as any[],
  expectedDate: '',
  status: 'pending'
});

const PurchaseOrders = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [language] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');
  const [formData, setFormData] = useState(getEmptyFormData);

  const t = translations[language];
  const supplierMap = new Map(suppliers.map((supplier) => [supplier._id, supplier.name]));

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, suppliersRes, productsRes] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/suppliers'),
        api.get('/products')
      ]);
      setOrders(ordersRes.data);
      setSuppliers(suppliersRes.data);
      setProducts(productsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productId: '', quantity: 1, purchasePrice: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    
    if (field === 'productId') {
      const product = products.find(p => p._id === value);
      if (product) {
        newItems[index].purchasePrice = product.purchasePrice || 0;
      }
    }
    
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        supplierId: formData.supplierId,
        expectedDeliveryDate: formData.expectedDate,
        status: 'Pending',
        totalAmount: formData.items.reduce(
          (sum, item) => sum + (Number(item.quantity || 0) * Number(item.purchasePrice || 0)),
          0
        ),
        items: formData.items.map((item) => {
          const product = products.find((entry) => entry._id === item.productId);

          return {
            productId: item.productId,
            name: product?.name || '',
            quantity: Number(item.quantity || 0),
            unitCost: Number(item.purchasePrice || 0)
          };
        })
      };

      await api.post('/purchase-orders', payload);
      setIsModalOpen(false);
      setFormData(getEmptyFormData());
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const markAsReceived = async (id: string) => {
    if (!window.confirm('Mark this order as received? This will update your product stock levels.')) return;
    try {
      await api.put(`/purchase-orders/${id}/receive`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!window.confirm(t.confirm_delete_user)) return;
    try {
      await api.delete(`/purchase-orders/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ClipboardList className="w-10 h-10 text-orange-500" />
            {t.purchase_orders}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Track your inventory replenishment and vendor orders.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          {language === 'fr' ? 'Nouvelle commande' : 'طلب جديد'}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Order ID</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Supplier</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Items</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Expected</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 font-bold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto" />
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No purchase orders found.
                  </td>
                </tr>
              ) : (
                orders.map((order) => (
                  <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-gray-500">
                      #{order._id.substring(order._id.length - 6).toUpperCase()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-orange-500" />
                        <span className="font-bold text-gray-900 dark:text-white">
                          {order.supplierId?.name || supplierMap.get(order.supplierId) || 'Unknown'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {order.items?.length || 0} items
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="w-4 h-4" />
                        {formatDate(order.expectedDeliveryDate || order.expectedDate)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        String(order.status).toLowerCase() === 'received' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {String(order.status).toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {String(order.status).toLowerCase() === 'pending' && (
                          <button
                            onClick={() => markAsReceived(order._id)}
                            className="p-2 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors"
                            title="Mark as Received"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteOrder(order._id)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {language === 'fr' ? 'Nouvelle commande d\'achat' : 'طلب شراء جديد'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.supplier}</label>
                  <select
                    required
                    value={formData.supplierId}
                    onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s._id} value={s._id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Expected Date</label>
                  <input
                    type="date"
                    required
                    value={formData.expectedDate}
                    onChange={(e) => setFormData({ ...formData, expectedDate: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-gray-900 dark:text-white">Order Items</h3>
                  <button
                    type="button"
                    onClick={addItem}
                    className="text-sm text-orange-500 font-bold hover:underline"
                  >
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-1">Product</label>
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => updateItem(index, 'productId', e.target.value)}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                        >
                          <option value="">Select Product</option>
                          {products.map(p => (
                            <option key={p._id} value={p._id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs text-gray-500 mb-1">Qty</label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs text-gray-500 mb-1">Unit Price</label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          value={item.purchasePrice}
                          onChange={(e) => updateItem(index, 'purchasePrice', parseFloat(e.target.value))}
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none"
                >
                  Create Order
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PurchaseOrders;
