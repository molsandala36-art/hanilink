import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle,
  Package,
  Loader2,
  CreditCard,
  Banknote,
  Smartphone,
  AlertTriangle,
  X
} from 'lucide-react';
import Fuse from 'fuse.js';
import { motion } from 'motion/react';
import api from '../services/api';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { translations, Language } from '../lib/translations';
import { Printer } from 'lucide-react';

interface Product {
  _id: string;
  name: string;
  price: number;
  purchasePrice: number;
  stock: number;
  category: string;
  tvaRate: number;
  supplierTva: number;
  place: string;
  photoUrl: string;
}

interface CartItem extends Product {
  quantity: number;
}

const POS = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'cmi'>('cash');
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');
  const [warning, setWarning] = useState<string | null>(null);
  const [showCMIPayment, setShowCMIPayment] = useState(false);
  const [cmiStatus, setCmiStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const t = translations[language];

  useEffect(() => {
    if (warning) {
      const timer = setTimeout(() => setWarning(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [warning]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        setProducts(res.data);
        setError('');
      } catch (err) {
        console.error(err);
        setError(language === 'ar' ? 'تعذر تحميل المنتجات' : 'Impossible de charger les produits');
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();

    const handleLangChange = () => {
      setLanguage((localStorage.getItem('language') as Language) || 'fr');
    };
    window.addEventListener('storage', handleLangChange);
    const interval = setInterval(handleLangChange, 1000); // Poll for language changes
    return () => {
      window.removeEventListener('storage', handleLangChange);
      clearInterval(interval);
    };
  }, []);

  const fuse = useMemo(() => new Fuse(products, {
    keys: ['name', 'category'],
    threshold: 0.3,
  }), [products]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    return fuse.search(searchTerm).map(result => result.item);
  }, [fuse, searchTerm, products]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      setWarning(language === 'ar' ? 'هذا المنتج غير متوفر' : 'Ce produit est en rupture de stock');
      return;
    }
    
    setCart(prev => {
      const existing = prev.find(item => item._id === product._id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setWarning(language === 'ar' ? 'تم الوصول إلى الحد الأقصى للمخزون' : 'Limite de stock atteinte');
          return prev;
        }
        return prev.map(item => 
          item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item._id !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item._id === productId) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return item;
        if (newQty > item.stock) {
          setWarning(language === 'ar' ? 'تم الوصول إلى الحد الأقصى للمخزون' : 'Limite de stock atteinte');
          return item;
        }
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const tvaTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity * (item.tvaRate || 20) / 100), 0);
  const total = subtotal + tvaTotal;

  const handlePrintReceipt = (sale: any) => {
    const savedSettings = localStorage.getItem('receiptSettings');
    const settings = savedSettings ? JSON.parse(savedSettings) : {
      logoUrl: '',
      fontSize: '14px',
      primaryColor: '#f97316'
    };

    const user = JSON.parse(localStorage.getItem('user') || '{}');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const receiptHtml = `
        <html>
          <head>
            <title>Facture HaniLink - ${sale._id}</title>
            <style>
              body { 
                font-family: sans-serif; 
                padding: 20px; 
                text-align: ${language === 'ar' ? 'right' : 'left'}; 
                direction: ${language === 'ar' ? 'rtl' : 'ltr'};
                font-size: ${settings.fontSize};
                color: #333;
              }
              .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #eee; padding-bottom: 15px; }
              .logo { max-height: 60px; margin-bottom: 10px; }
              .shop-info { font-size: 10px; color: #666; margin-top: 5px; }
              .legal-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 5px; }
              .details { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; font-size: 12px; }
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              th, td { padding: 10px 8px; border-bottom: 1px solid #eee; text-align: ${language === 'ar' ? 'right' : 'left'}; }
              th { background-color: #f9f9f9; font-size: 11px; text-transform: uppercase; color: #888; }
              .total-section { margin-top: 20px; border-top: 2px solid #eee; pt: 10px; }
              .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; }
              .total-row.grand-total { font-size: 18px; font-weight: bold; margin-top: 10px; border-top: 1px solid #eee; padding-top: 10px; }
              .accent { color: ${settings.primaryColor}; }
              @media print {
                body { padding: 0; }
                .no-print { display: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              ${settings.logoUrl ? `<img src="${settings.logoUrl}" class="logo" />` : `<h1 class="accent" style="margin:0">${user.shopName || 'HaniLink'}</h1>`}
              <p style="margin: 5px 0; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 1px;">${language === 'ar' ? 'فاتورة قانونية' : 'Facture Légale'}</p>
              
              <div class="shop-info">
                ${user.address ? `<p style="margin: 2px 0">${user.address}</p>` : ''}
                <div class="legal-grid">
                  ${user.ice ? `<span><strong>ICE:</strong> ${user.ice}</span>` : ''}
                  ${user.if ? `<span><strong>IF:</strong> ${user.if}</span>` : ''}
                  ${user.rc ? `<span><strong>RC:</strong> ${user.rc}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="details">
              <div style="display: flex; justify-content: space-between;">
                <div>
                  <p><strong>N° Facture:</strong> #${sale._id.slice(-8).toUpperCase()}</p>
                  <p><strong>Date:</strong> ${formatDate(sale.createdAt)}</p>
                </div>
                <div style="text-align: ${language === 'ar' ? 'left' : 'right'}">
                  <p><strong>${t.payment_method}:</strong> ${t[sale.paymentMethod]}</p>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>${t.product_name}</th>
                  <th style="text-align: center">${language === 'ar' ? 'الكمية' : 'Qté'}</th>
                  <th style="text-align: right">${t.price}</th>
                  <th style="text-align: right">Total</th>
                </tr>
              </thead>
              <tbody>
                ${sale.items.map((item: any) => `
                  <tr>
                    <td>
                      <div style="font-weight: bold">${item.name}</div>
                      <div style="font-size: 10px; color: #888">TVA: ${item.tvaRate}%</div>
                    </td>
                    <td style="text-align: center">${item.quantity}</td>
                    <td style="text-align: right">${formatCurrency(item.price)}</td>
                    <td style="text-align: right; font-weight: bold">${formatCurrency(item.price * item.quantity)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>

            <div class="total-section">
              <div class="total-row">
                <span>${t.total_ht}:</span>
                <span>${formatCurrency(sale.totalAmount - sale.tvaAmount)}</span>
              </div>
              <div class="total-row">
                <span>${t.total_tva}:</span>
                <span>${formatCurrency(sale.tvaAmount)}</span>
              </div>
              <div class="total-row grand-total">
                <span>${t.total_ttc}:</span>
                <span class="accent">${formatCurrency(sale.totalAmount)}</span>
              </div>
            </div>

            <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #eee; padding-top: 20px;">
              ${language === 'ar' ? 'شكرا لثقتكم بنا' : 'Merci de votre confiance'}
              <p style="margin-top: 5px;">HaniLink POS - Logiciel de Gestion</p>
            </div>
            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 500);
              };
            </script>
          </body>
        </html>
      `;
      printWindow.document.write(receiptHtml);
      printWindow.document.close();
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    setShowConfirmModal(true);
  };

  const processSale = async () => {
    setShowConfirmModal(false);
    if (paymentMethod === 'cmi') {
      setShowCMIPayment(true);
      setCmiStatus('processing');
      // Simulate CMI payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      setCmiStatus('success');
      await new Promise(resolve => setTimeout(resolve, 1000));
      setShowCMIPayment(false);
      setCmiStatus('idle');
    }

    setSubmitting(true);
    try {
      setError('');
      const res = await api.post('/sales', {
        items: cart.map(item => ({
          productId: item._id,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          tvaRate: item.tvaRate || 20
        })),
        totalAmount: total,
        tvaAmount: tvaTotal,
        paymentMethod
      });
      
      const newSale = res.data;
      setCart([]);
      setSuccess(true);
      
      // Automatically print receipt
      handlePrintReceipt(newSale);

      setTimeout(() => setSuccess(false), 3000);
      
      // Refresh products to update stock
      const productsRes = await api.get('/products');
      setProducts(productsRes.data);
    } catch (err) {
      console.error(err);
      setError(
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        (language === 'ar' ? 'حدث خطأ أثناء البيع' : 'Erreur lors de la vente')
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-8">
      {/* Product Selection */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.pos}</h1>
          <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'اختر المنتجات للبيع' : 'Sélectionnez les produits pour la vente'}</p>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}

        <div className="relative mb-6">
          <Search className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5", language === 'ar' ? "right-3" : "left-3")} />
          <input 
            type="text" 
            placeholder={t.search_product}
            className={cn(
              "w-full py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none shadow-sm dark:text-white",
              language === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
            )}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
            {loading ? (
              <div className="col-span-full py-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
              </div>
            ) : filteredProducts.map((product) => (
              <button
                key={product._id}
                disabled={product.stock <= 0}
                onClick={() => addToCart(product)}
                className={cn(
                  "bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm text-left transition-all hover:shadow-md active:scale-95 group",
                  product.stock <= 0 && "opacity-50 grayscale cursor-not-allowed",
                  language === 'ar' && "text-right"
                )}
              >
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl mb-3 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40 transition-colors inline-block text-orange-600 dark:text-orange-400 w-12 h-12 flex items-center justify-center overflow-hidden">
                  {product.photoUrl ? (
                    <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-6 h-6" />
                  )}
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white truncate">{product.name}</h3>
                <p className="text-orange-600 dark:text-orange-400 font-bold mt-1">{formatCurrency(product.price)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{t.stock}: {product.stock}</span>
                  {product.stock <= 0 && <span className="text-xs text-red-500 font-bold">{language === 'ar' ? 'نفذ' : 'Épuisé'}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cart / Checkout */}
      <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-orange-500" />
            {language === 'ar' ? 'السلة الحالية' : 'Panier actuel'}
          </h2>
        </div>

        <div className="flex-1 overflow-auto p-6 space-y-4">
          {cart.map((item) => (
            <div key={item._id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white truncate">{item.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(item.price)} / {language === 'ar' ? 'وحدة' : 'unité'}</p>
                {item.quantity >= item.stock && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1 mt-0.5 animate-pulse">
                    <AlertTriangle className="w-3 h-3" />
                    {t.stock_exceeded} ({item.stock})
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => updateQuantity(item._id, -1)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="w-8 text-center font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                <button 
                  onClick={() => updateQuantity(item._id, 1)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <button 
                onClick={() => removeFromCart(item._id)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {cart.length === 0 && !success && (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
              <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
              <p>{language === 'ar' ? 'السلة فارغة' : 'Le panier est vide'}</p>
            </div>
          )}
          {success && (
            <div className="h-full flex flex-col items-center justify-center text-green-600 py-12 animate-in fade-in zoom-in">
              <CheckCircle className="w-12 h-12 mb-4" />
              <p className="font-bold">{language === 'ar' ? 'تمت العملية بنجاح!' : 'Vente réussie !'}</p>
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 space-y-4">
          {warning && (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 p-2 rounded-lg text-xs font-bold text-center animate-in fade-in slide-in-from-bottom-2">
              {warning}
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">{t.payment_method}</p>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => setPaymentMethod('cash')}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                  paymentMethod === 'cash' ? "bg-orange-500 border-orange-500 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                )}
              >
                <Banknote className="w-4 h-4" />
                <span className="text-[10px] font-bold">{t.cash}</span>
              </button>
              <button 
                onClick={() => setPaymentMethod('card')}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                  paymentMethod === 'card' ? "bg-orange-500 border-orange-500 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                )}
              >
                <CreditCard className="w-4 h-4" />
                <span className="text-[10px] font-bold">{t.card}</span>
              </button>
              <button 
                onClick={() => setPaymentMethod('cmi')}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg border transition-all",
                  paymentMethod === 'cmi' ? "bg-orange-500 border-orange-500 text-white" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                )}
              >
                <Smartphone className="w-4 h-4" />
                <span className="text-[10px] font-bold">CMI</span>
              </button>
            </div>
          </div>

          <div className="space-y-1 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{t.subtotal}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>{t.tva}</span>
              <span>{formatCurrency(tvaTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-xl font-bold text-gray-900 dark:text-white pt-2">
              <span>{t.total}</span>
              <motion.span 
                key={total}
                initial={{ scale: 1.1, color: '#f97316' }}
                animate={{ scale: 1, color: 'inherit' }}
                className="text-orange-500"
              >
                {formatCurrency(total)}
              </motion.span>
            </div>
          </div>
          <button
            disabled={cart.length === 0 || submitting}
            onClick={handleCheckout}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t.checkout}
          </button>
        </div>
      </div>

      {/* CMI Payment Modal */}
      {showCMIPayment && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl"
          >
            <div className="mb-6 flex justify-center">
              <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                <Smartphone className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Paiement CMI</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              {cmiStatus === 'processing' ? 'Traitement de la transaction en cours...' : 'Paiement effectué avec succès !'}
            </p>
            
            {cmiStatus === 'processing' ? (
              <div className="flex justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                  <CheckCircle className="w-8 h-8" />
                </div>
              </div>
            )}
            
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
              <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Centre Monétique Interbancaire</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Order Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden"
          >
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-orange-500" />
                {t.order_summary}
              </h2>
              <button onClick={() => setShowConfirmModal(false)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 max-h-[50vh] overflow-y-auto">
              <div className="space-y-4">
                {cart.map((item) => (
                  <div key={item._id} className="flex justify-between items-center py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                    <div>
                      <p className="font-bold text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.quantity} x {formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 space-y-4">
              <div className="flex justify-between items-center text-lg font-bold text-gray-900 dark:text-white">
                <span>{t.total}</span>
                <span className="text-orange-500 text-2xl">{formatCurrency(total)}</span>
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="flex-1 px-6 py-3 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={processSale}
                  disabled={submitting}
                  className="flex-1 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : t.confirm_order}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default POS;
