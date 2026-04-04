import { useState, useEffect } from 'react';
import { 
  Brain, 
  TrendingUp, 
  ShoppingCart, 
  AlertTriangle, 
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import api from '../services/api';
import { formatCurrency, cn } from '../lib/utils';
import { translations, Language } from '../lib/translations';

interface Insight {
  productId: string;
  name: string;
  type: 'demand' | 'repurchase';
  message: string;
  confidence: number;
  trend?: 'up' | 'down' | 'stable';
}

const REORDER_QUANTITY = 50;

const AIInsights = () => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingOrderFor, setCreatingOrderFor] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];

  useEffect(() => {
    fetchInsights();
    const handleLangChange = () => {
      setLanguage((localStorage.getItem('language') as Language) || 'fr');
    };
    window.addEventListener('storage', handleLangChange);
    const interval = setInterval(handleLangChange, 1000);
    return () => {
      window.removeEventListener('storage', handleLangChange);
      clearInterval(interval);
    };
  }, []);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      // In a real app, this would call a backend endpoint that uses Gemini
      // For now, we'll simulate the AI logic
      const [productsRes, salesRes] = await Promise.all([
        api.get('/products'),
        api.get('/sales')
      ]);

      const products = productsRes.data;
      const sales = salesRes.data;
      setProducts(products);

      // Mock AI Logic
      const newInsights: Insight[] = [];

      products.forEach((product: any) => {
        // Demand Prediction Logic (Simple)
        const productSales = sales.filter((s: any) => s.items.some((i: any) => i.productId === product._id));
        if (productSales.length > 5) {
          newInsights.push({
            productId: product._id,
            name: product.name,
            type: 'demand',
            message: language === 'ar' 
              ? `من المتوقع زيادة الطلب على ${product.name} بنسبة 15% الأسبوع المقبل.`
              : `La demande pour ${product.name} devrait augmenter de 15% la semaine prochaine.`,
            confidence: 0.85,
            trend: 'up'
          });
        }

        // Repurchase Suggestion Logic
        if (product.stock < 10) {
          newInsights.push({
            productId: product._id,
            name: product.name,
            type: 'repurchase',
            message: language === 'ar'
              ? `المخزون منخفض لـ ${product.name}. نقترح إعادة شراء 50 وحدة.`
              : `Le stock est bas pour ${product.name}. Nous suggérons de racheter 50 unités.`,
            confidence: 0.92
          });
        }
      });

      setInsights(newInsights);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const createPurchaseOrderFromInsight = async (insight: Insight) => {
    const product = products.find((entry) => entry._id === insight.productId);

    if (!product) {
      alert(language === 'ar' ? 'المنتج غير موجود' : 'Produit introuvable');
      return;
    }

    if (!product.supplierId) {
      alert(
        language === 'ar'
          ? 'يجب ربط هذا المنتج بمورد قبل إنشاء طلب شراء.'
          : 'Ce produit doit être lié à un fournisseur avant de créer un bon de commande.'
      );
      return;
    }

    setCreatingOrderFor(insight.productId);

    try {
      await api.post('/purchase-orders', {
        supplierId: product.supplierId,
        expectedDeliveryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'Pending',
        totalAmount: Number(product.purchasePrice || 0) * REORDER_QUANTITY,
        items: [
          {
            productId: product._id,
            name: product.name,
            quantity: REORDER_QUANTITY,
            unitCost: Number(product.purchasePrice || 0)
          }
        ]
      });

      alert(language === 'ar' ? 'تم إنشاء طلب الشراء بنجاح' : 'Bon de commande créé avec succès');
    } catch (err) {
      console.error(err);
      alert(language === 'ar' ? 'فشل إنشاء طلب الشراء' : 'Échec de la création du bon de commande');
    } finally {
      setCreatingOrderFor(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Brain className="w-8 h-8 text-orange-500" />
            {t.ai_insights}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'تحليلات ذكية مدعومة بالذكاء الاصطناعي لعملك' : 'Analyses intelligentes propulsées par l\'IA pour votre entreprise'}</p>
        </div>
        <button 
          onClick={fetchInsights}
          disabled={loading}
          className="flex items-center gap-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold shadow-sm"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          {language === 'ar' ? 'تحديث التحليلات' : 'Actualiser les analyses'}
        </button>
      </div>

      {loading ? (
        <div className="h-96 flex flex-col items-center justify-center text-gray-500">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mb-4" />
          <p className="animate-pulse">{language === 'ar' ? 'جاري تحليل البيانات...' : 'Analyse des données en cours...'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Demand Prediction Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              {t.demand_prediction}
            </h2>
            <div className="grid gap-4">
              {insights.filter(i => i.type === 'demand').map((insight, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl text-blue-600 dark:text-blue-400">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
                      <ArrowUpRight className="w-3 h-3" />
                      {Math.round(insight.confidence * 100)}% {language === 'ar' ? 'ثقة' : 'confiance'}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{insight.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{insight.message}</p>
                </div>
              ))}
              {insights.filter(i => i.type === 'demand').length === 0 && (
                <div className="p-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>{language === 'ar' ? 'لا توجد توقعات حالياً' : 'Aucune prédiction pour le moment'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Repurchase Suggestion Section */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-orange-500" />
              {t.repurchase_suggestion}
            </h2>
            <div className="grid gap-4">
              {insights.filter(i => i.type === 'repurchase').map((insight, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl text-orange-600 dark:text-orange-400">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">
                      {Math.round(insight.confidence * 100)}% {language === 'ar' ? 'ثقة' : 'confiance'}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-2">{insight.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{insight.message}</p>
                  <button
                    onClick={() => createPurchaseOrderFromInsight(insight)}
                    disabled={creatingOrderFor === insight.productId}
                    className="mt-4 w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {creatingOrderFor === insight.productId && <Loader2 className="w-4 h-4 animate-spin" />}
                    {language === 'ar' ? 'إنشاء طلب شراء' : 'Créer un bon de commande'}
                  </button>
                </div>
              ))}
              {insights.filter(i => i.type === 'repurchase').length === 0 && (
                <div className="p-12 text-center bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>{language === 'ar' ? 'المخزون كافٍ حالياً' : 'Le stock est suffisant pour le moment'}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIInsights;


