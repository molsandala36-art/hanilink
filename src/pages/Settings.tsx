import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Save, CheckCircle2, Upload, X as CloseIcon, Building2, Database, RefreshCw } from 'lucide-react';
import { translations, Language } from '../lib/translations';
import api from '../services/api';
import { cn, formatDate, getDefaultVatRate } from '../lib/utils';
import {
  type DocumentDesign,
  type DocumentStyleSettings,
  defaultDocumentStyleSettings,
  normalizeDocumentSettings,
  saveDocumentSettings,
} from '../lib/documentSettings';
import { isSupabaseConfigured } from '../lib/backend';

interface UserLegalInfo {
  shopName: string;
  ice: string;
  if: string;
  rc: string;
  address: string;
}

interface SyncStatus {
  isOnline: boolean;
  pendingOperations: number;
  localDbPath: string;
  fileSizeBytes: number;
  lastSyncAt: string | null;
  lastError: string | null;
  collectionCounts: Record<string, number>;
}

const Settings = () => {
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');
  const [user, setUser] = useState<any>(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const [legalInfo, setLegalInfo] = useState<UserLegalInfo>({
    shopName: user.shopName || '',
    ice: user.ice || '',
    if: user.if || '',
    rc: user.rc || '',
    address: user.address || ''
  });
  const [invoiceSettings, setInvoiceSettings] = useState<DocumentStyleSettings>(() => {
    const saved = localStorage.getItem('invoiceSettings') ?? localStorage.getItem('receiptSettings');
    return saved ? normalizeDocumentSettings(JSON.parse(saved)) : defaultDocumentStyleSettings;
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const [isSavingVat, setIsSavingVat] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [defaultVatRate, setDefaultVatRate] = useState(getDefaultVatRate);

  const t = translations[language];
  const offlineReadyInCurrentMode = isSupabaseConfigured();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await api.get(`/users`);
        const currentUser = res.data.find((u: any) => u._id === user.id || u._id === user._id);
        if (currentUser) {
          setLegalInfo({
            shopName: currentUser.shopName,
            ice: currentUser.ice || '',
            if: currentUser.if || '',
            rc: currentUser.rc || '',
            address: currentUser.address || ''
          });
          const updatedUser = { ...user, ...currentUser };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      } catch (err) {
        console.error('Failed to fetch user data', err);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
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

  const fetchSyncStatus = async () => {
    try {
      const res = await api.get('/sync/status');
      setSyncStatus(res.data);
    } catch (err) {
      console.error('Failed to fetch sync status', err);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveDocumentSettings(invoiceSettings);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleSaveLegal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLegal(true);
    try {
      const userId = user.id || user._id;
      await api.put(`/users/${userId}`, legalInfo);
      const updatedUser = { ...user, ...legalInfo };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save legal info', err);
      alert('Erreur lors de l\'enregistrement des informations légales');
    } finally {
      setIsSavingLegal(false);
    }
  };

  const handleSaveVat = async () => {
    const normalizedVatRate = defaultVatRate.trim() === '' ? '0' : defaultVatRate.trim();
    const parsedVatRate = Number(normalizedVatRate);

    if (Number.isNaN(parsedVatRate) || parsedVatRate < 0) {
      alert(language === 'ar' ? 'ÙŠØ¬Ø¨ Ø¥Ø¯Ø®Ø§Ù„ Ù†Ø³Ø¨Ø© TVA ØµØ§Ù„Ø­Ø©' : 'Veuillez saisir un taux de TVA valide');
      return;
    }

    setIsSavingVat(true);
    try {
      localStorage.setItem('defaultVatRate', normalizedVatRate);
      setDefaultVatRate(normalizedVatRate);

      const productsRes = await api.get('/products');
      const products = Array.isArray(productsRes.data) ? productsRes.data.filter(Boolean) : [];

      const productUpdates = products
        .map((product: any) => {
          const productId = product?._id || product?.id;
          if (!productId) return null;

          return api.put(`/products/${productId}`, {
            name: product?.name || '',
            price: Number(product?.price || 0),
            purchasePrice: Number(product?.purchasePrice || 0),
            stock: Number(product?.stock || 0),
            category: product?.category || 'General',
            tvaRate: parsedVatRate,
            supplierTva: parsedVatRate,
            barcode: product?.barcode || '',
            place: product?.place || '',
            photoUrl: product?.photoUrl || '',
            supplierId: product?.supplierId || ''
          });
        })
        .filter(Boolean) as Promise<any>[];

      const results = await Promise.allSettled(productUpdates);
      const failedUpdates = results.filter((result) => result.status === 'rejected');

      if (failedUpdates.length > 0) {
        console.error('Some VAT updates failed', failedUpdates);
        throw new Error(`${failedUpdates.length} product updates failed`);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to apply VAT rate to products', err);
      alert(
        language === 'ar'
          ? 'ØªØ¹Ø°Ø± ØªØ·Ø¨ÙŠÙ‚ Ù†Ø³Ø¨Ø© TVA Ø¹Ù„Ù‰ Ø¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ù†ØªØ¬Ø§Øª'
          : 'Impossible d’appliquer la TVA sur tous les produits'
      );
    } finally {
      setIsSavingVat(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceSettings({ ...invoiceSettings, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const clearLogo = () => {
    setInvoiceSettings({ ...invoiceSettings, logoUrl: '' });
  };

  const designOptions: Array<{ value: DocumentDesign; label: string; description: string }> = [
    {
      value: 'modern',
      label: 'Modern',
      description: language === 'ar' ? 'تصميم حديث مع ترويسة قوية' : 'Design moderne avec en-tete premium'
    },
    {
      value: 'classic',
      label: 'Classic',
      description: language === 'ar' ? 'تصميم مهني وتقليدي' : 'Design classique et professionnel'
    },
    {
      value: 'compact',
      label: 'Compact',
      description: language === 'ar' ? 'تصميم مضغوط وواضح' : 'Design compact pour impression rapide'
    }
  ];

  const previewTitle = language === 'ar' ? 'فاتورة قانونية' : 'Facture legale';

  const renderPreview = (settings: DocumentStyleSettings) => {
    if (settings.documentDesign === 'classic') {
      return (
        <div
          className="border border-gray-300 p-6 rounded-lg bg-white text-black mx-auto max-w-[320px] shadow-inner"
          style={{ fontSize: settings.fontSize, direction: language === 'ar' ? 'rtl' : 'ltr' }}
        >
          <div className="h-2 rounded-full mb-4" style={{ backgroundColor: settings.primaryColor }} />
          <div className="flex items-center justify-between gap-4 border-b border-gray-300 pb-4 mb-4">
            <div>
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto max-w-[120px] object-contain" />
              ) : (
                <div className="text-lg font-bold" style={{ color: settings.primaryColor }}>
                  {legalInfo.shopName || 'HaniLink'}
                </div>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{previewTitle}</div>
              <div className="text-xs text-gray-500">BA-2026-001</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[10px] mb-4">
            <div className="border border-gray-300 p-2">
              <div className="font-semibold mb-1">Entreprise</div>
              <div>{legalInfo.shopName || 'HaniLink'}</div>
              <div>{legalInfo.address || 'Adresse boutique'}</div>
            </div>
            <div className="border border-gray-300 p-2">
              <div className="font-semibold mb-1">Client</div>
              <div>Client exemple</div>
              <div>Casablanca</div>
            </div>
          </div>
          <div className="border border-gray-300">
            <div className="grid grid-cols-[1.6fr_0.6fr_0.8fr] text-[10px] font-semibold bg-gray-100">
              <div className="p-2">{t.product}</div>
              <div className="p-2 text-right">{t.quantity}</div>
              <div className="p-2 text-right">{t.total}</div>
            </div>
            <div className="grid grid-cols-[1.6fr_0.6fr_0.8fr] text-[10px]">
              <div className="p-2">Produit Exemple</div>
              <div className="p-2 text-right">1</div>
              <div className="p-2 text-right">100.00 DH</div>
            </div>
          </div>
          <div className="mt-4 text-right space-y-1 text-[10px]">
            <div className="flex justify-between"><span>{t.total_ht}</span><span>83.33 DH</span></div>
            <div className="flex justify-between"><span>{t.total_tva}</span><span>16.67 DH</span></div>
            <div className="flex justify-between font-bold pt-2 border-t border-gray-200" style={{ color: settings.primaryColor }}>
              <span>{t.total_ttc}</span><span>100.00 DH</span>
            </div>
          </div>
        </div>
      );
    }

    if (settings.documentDesign === 'compact') {
      return (
        <div
          className="border border-gray-200 p-5 rounded-2xl bg-white text-black mx-auto max-w-[320px] shadow-inner"
          style={{ fontSize: settings.fontSize, direction: language === 'ar' ? 'rtl' : 'ltr' }}
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-10 w-auto max-w-[110px] object-contain" />
            ) : (
              <div className="px-3 py-2 rounded-xl text-white font-bold text-sm" style={{ backgroundColor: settings.primaryColor }}>
                {legalInfo.shopName || 'HaniLink'}
              </div>
            )}
            <div className="text-right">
              <div className="font-bold">{previewTitle}</div>
              <div className="text-[10px] text-gray-500">BT-2026-004</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px] border border-gray-200 rounded-xl p-3 bg-gray-50 mb-3">
            <div><span className="font-semibold">Date:</span> 23/04/2026</div>
            <div><span className="font-semibold">Client:</span> Client exemple</div>
            <div><span className="font-semibold">ICE:</span> {legalInfo.ice || '0000'}</div>
            <div><span className="font-semibold">RC:</span> {legalInfo.rc || '0000'}</div>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <div className="grid grid-cols-[1.7fr_0.6fr_0.8fr] text-[10px] text-white" style={{ backgroundColor: settings.primaryColor }}>
              <div className="p-2">{t.product}</div>
              <div className="p-2 text-right">{t.quantity}</div>
              <div className="p-2 text-right">{t.total}</div>
            </div>
            <div className="grid grid-cols-[1.7fr_0.6fr_0.8fr] text-[10px] bg-white">
              <div className="p-2">Produit Exemple</div>
              <div className="p-2 text-right">1</div>
              <div className="p-2 text-right">100.00 DH</div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 p-3 text-[10px]">
            <div className="flex justify-between"><span>{t.total_ht}</span><span>83.33 DH</span></div>
            <div className="flex justify-between"><span>{t.total_tva}</span><span>16.67 DH</span></div>
            <div className="flex justify-between font-bold pt-2 mt-2 border-t border-orange-200" style={{ color: settings.primaryColor }}>
              <span>{t.total_ttc}</span><span>100.00 DH</span>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className="border border-gray-200 p-6 rounded-lg bg-white text-black mx-auto max-w-[320px] shadow-inner"
        style={{ fontSize: settings.fontSize, direction: language === 'ar' ? 'rtl' : 'ltr' }}
      >
        <div
          className="rounded-2xl p-4 text-white mb-4"
          style={{ background: `linear-gradient(135deg, ${settings.primaryColor} 0%, #111827 100%)` }}
        >
          <div className="flex items-start justify-between gap-4">
            {settings.logoUrl ? (
              <img src={settings.logoUrl} alt="Logo" className="h-12 w-auto max-w-[120px] rounded-lg bg-white/10 p-2 object-contain" />
            ) : (
              <div className="rounded-xl bg-white/10 px-4 py-3 text-lg font-bold">{legalInfo.shopName || 'HaniLink'}</div>
            )}
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">HaniLink</div>
              <div className="text-lg font-bold">{previewTitle}</div>
              <div className="text-xs opacity-80">DV-2026-008</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4 text-[10px]">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="font-semibold mb-1">Entreprise</div>
            <div>{legalInfo.shopName || 'HaniLink'}</div>
            <div>{legalInfo.address || 'Adresse boutique'}</div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div className="font-semibold mb-1">Client</div>
            <div>Client exemple</div>
            <div>Casablanca</div>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 mb-4">
          <div className="grid grid-cols-[1.7fr_0.6fr_0.8fr] bg-gray-900 text-[10px] text-white">
            <div className="p-2">{t.product}</div>
            <div className="p-2 text-right">{t.quantity}</div>
            <div className="p-2 text-right">{t.total}</div>
          </div>
          <div className="grid grid-cols-[1.7fr_0.6fr_0.8fr] text-[10px]">
            <div className="p-2">Produit Exemple</div>
            <div className="p-2 text-right">1</div>
            <div className="p-2 text-right">100.00 DH</div>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3 items-start">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-[10px]">
            Merci pour votre confiance.
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-[10px] min-w-[120px]">
            <div className="flex justify-between gap-4"><span>{t.total_ht}</span><span>83.33 DH</span></div>
            <div className="flex justify-between gap-4"><span>{t.total_tva}</span><span>16.67 DH</span></div>
            <div className="flex justify-between gap-4 font-bold pt-2 mt-2 border-t border-orange-200" style={{ color: settings.primaryColor }}>
              <span>{t.total_ttc}</span><span>100.00 DH</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const runSync = async (mode: 'pull' | 'push') => {
    setIsSyncLoading(true);
    try {
      await api.post(`/sync/${mode}`);
      await fetchSyncStatus();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Sync failed', err);
      alert(language === 'ar' ? 'فشلت عملية المزامنة' : 'La synchronisation a échoué');
    } finally {
      setIsSyncLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <SettingsIcon className="w-8 h-8 text-orange-500" />
            {t.settings}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'ar' ? 'تخصيص إعدادات التطبيق والفاتورة' : 'Personnalisez les paramètres de l\'application et de la facture'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Legal Info Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">
              {language === 'ar' ? 'المعلومات القانونية (المغرب)' : 'Informations Légales (Maroc)'}
            </h2>
          </div>
          
          <form onSubmit={handleSaveLegal} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.shop_name}</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={legalInfo.shopName}
                  onChange={(e) => setLegalInfo({ ...legalInfo, shopName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.ice}</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={legalInfo.ice}
                  onChange={(e) => setLegalInfo({ ...legalInfo, ice: e.target.value })}
                  placeholder="000000000000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.if}</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={legalInfo.if}
                  onChange={(e) => setLegalInfo({ ...legalInfo, if: e.target.value })}
                  placeholder="00000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.rc}</label>
                <input 
                  type="text"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={legalInfo.rc}
                  onChange={(e) => setLegalInfo({ ...legalInfo, rc: e.target.value })}
                  placeholder="000000"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.address}</label>
                <textarea 
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white resize-none"
                  rows={2}
                  value={legalInfo.address}
                  onChange={(e) => setLegalInfo({ ...legalInfo, address: e.target.value })}
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={isSavingLegal}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
            >
              <Save className="w-5 h-5" />
              {isSavingLegal ? (language === 'ar' ? 'جاري الحفظ...' : 'Enregistrement...') : t.save_settings}
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
            <Printer className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">{t.invoice_settings}</h2>
          </div>
          
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t.logo_url} / {t.upload_logo}
                </label>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      placeholder="https://example.com/logo.png"
                      className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={invoiceSettings.logoUrl.startsWith('data:') ? '' : invoiceSettings.logoUrl}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, logoUrl: e.target.value })}
                    />
                    {invoiceSettings.logoUrl && (
                      <button 
                        type="button"
                        onClick={clearLogo}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <CloseIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <label 
                      htmlFor="logo-upload"
                      className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl cursor-pointer hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/10 transition-all"
                    >
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {invoiceSettings.logoUrl.startsWith('data:') ? 'Logo chargé' : t.upload_logo}
                      </span>
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'ar' ? 'اترك فارغاً لاستخدام اسم المتجر' : 'Laissez vide pour utiliser le nom de la boutique'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.font_size}
                  </label>
                  <select 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={invoiceSettings.fontSize}
                    onChange={(e) => setInvoiceSettings({ ...invoiceSettings, fontSize: e.target.value })}
                  >
                    <option value="12px">Petit (12px)</option>
                    <option value="14px">Normal (14px)</option>
                    <option value="16px">Grand (16px)</option>
                    <option value="18px">Très Grand (18px)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t.primary_color}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="color" 
                      className="h-10 w-20 p-1 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg cursor-pointer"
                      value={invoiceSettings.primaryColor}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, primaryColor: e.target.value })}
                    />
                    <input 
                      type="text" 
                      className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white font-mono"
                      value={invoiceSettings.primaryColor}
                      onChange={(e) => setInvoiceSettings({ ...invoiceSettings, primaryColor: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {language === 'ar' ? 'تصميم الوثيقة' : 'Design du document'}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {designOptions.map((option) => {
                      const active = invoiceSettings.documentDesign === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setInvoiceSettings({ ...invoiceSettings, documentDesign: option.value })}
                          className={cn(
                            'rounded-2xl border px-4 py-4 text-left transition-all',
                            active
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-sm'
                              : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 hover:bg-gray-50 dark:hover:bg-gray-900/40'
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-gray-900 dark:text-white">{option.label}</div>
                              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{option.description}</div>
                            </div>
                            <div
                              className={cn(
                                'h-3 w-3 rounded-full border',
                                active ? 'border-orange-500 bg-orange-500' : 'border-gray-300 dark:border-gray-600'
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-4">
              <button 
                type="submit"
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-orange-200 dark:shadow-none"
              >
                <Save className="w-5 h-5" />
                {t.save_settings}
              </button>
            </div>

            {showSuccess && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-bold">
                  {language === 'ar' ? 'تم حفظ الإعدادات بنجاح' : 'Paramètres enregistrés avec succès'}
                </span>
              </div>
            )}
          </form>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-orange-500" />
            <h2 className="font-bold text-gray-900 dark:text-white">{t.vat_settings}</h2>
          </div>
          
          <div className="p-6">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t.default_vat_rate}
              </label>
              <div className="flex gap-2">
                <input 
                  type="number" 
                  min="0"
                  step="0.01"
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={defaultVatRate}
                  onChange={(e) => setDefaultVatRate(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={handleSaveVat}
                  disabled={isSavingVat}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold transition-all"
                >
                  {isSavingVat ? (language === 'ar' ? 'Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚...' : 'Application...') : t.save_settings}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-400" />
            {language === 'ar' ? 'التخزين المحلي والمزامنة' : 'Stockage local et synchronisation'}
          </h3>

          {offlineReadyInCurrentMode && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-200">
              {language === 'ar'
                ? 'يمكنك الاستمرار محلياً عند انقطاع الإنترنت، وستتم مزامنة العمليات المعلقة مع Supabase عند عودة الاتصال.'
                : 'Vous pouvez continuer a travailler localement hors ligne. Les operations en attente seront resynchronisees vers Supabase au retour de la connexion.'}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                {language === 'ar' ? 'État de connexion' : 'Etat de connexion'}
              </p>
              <p className={cn("font-bold", syncStatus?.isOnline ? "text-green-600" : "text-amber-600")}>
                {syncStatus?.isOnline
                  ? language === 'ar'
                    ? 'متصل'
                    : 'En ligne'
                  : language === 'ar'
                    ? 'دون اتصال'
                    : 'Hors ligne'}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                {language === 'ar' ? 'Taille cache local' : 'Taille cache local'}
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {syncStatus ? `${(syncStatus.fileSizeBytes / 1024).toFixed(2)} KB` : '-'}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                {language === 'ar' ? 'Operations en attente' : 'Operations en attente'}
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {syncStatus?.pendingOperations ?? 0}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                {language === 'ar' ? 'Derniere synchro Supabase' : 'Derniere synchro Supabase'}
              </p>
              <p className="font-bold text-gray-900 dark:text-white">
                {syncStatus?.lastSyncAt ? formatDate(syncStatus.lastSyncAt) : '-'}
              </p>
            </div>
          </div>

          {syncStatus?.lastError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
              {syncStatus.lastError}
            </div>
          )}

          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 mb-4">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">
              {language === 'ar' ? 'Collections locales' : 'Collections locales'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Object.entries(syncStatus?.collectionCounts || {}).map(([key, value]) => (
                <div key={key} className="rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-800">
                  <p className="text-gray-500">{key}</p>
                  <p className="font-bold text-gray-900 dark:text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => runSync('push')}
              disabled={isSyncLoading || !offlineReadyInCurrentMode}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isSyncLoading && "animate-spin")} />
              {language === 'ar' ? 'Sync vers Supabase' : 'Sync vers Supabase'}
            </button>
            <button
              onClick={fetchSyncStatus}
              disabled={isSyncLoading}
              className="px-4 py-2 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              {language === 'ar' ? 'Rafraichir le statut' : 'Rafraichir le statut'}
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Printer className="w-5 h-5 text-gray-400" />
            {language === 'ar' ? 'معاينة الفاتورة' : 'Aperçu de la facture'}
          </h3>
          {renderPreview(invoiceSettings)}
          <div 
            className="hidden border border-gray-200 dark:border-gray-700 p-6 rounded-lg bg-white text-black mx-auto max-w-[300px] shadow-inner"
            style={{ fontSize: invoiceSettings.fontSize, direction: language === 'ar' ? 'rtl' : 'ltr' }}
          >
            <div className="text-center mb-4">
              {invoiceSettings.logoUrl ? (
                <img src={invoiceSettings.logoUrl} alt="Logo" className="h-12 mx-auto mb-2 object-contain" />
              ) : (
                <h1 className="font-bold text-xl" style={{ color: invoiceSettings.primaryColor }}>{legalInfo.shopName || 'HaniLink'}</h1>
              )}
              <p className="text-[10px] text-gray-500">Facture Légale</p>
              {legalInfo.address && <p className="text-[8px] text-gray-400 mt-1">{legalInfo.address}</p>}
              <div className="flex flex-wrap justify-center gap-x-2 text-[8px] text-gray-400 mt-1">
                {legalInfo.ice && <span>ICE: {legalInfo.ice}</span>}
                {legalInfo.if && <span>IF: {legalInfo.if}</span>}
                {legalInfo.rc && <span>RC: {legalInfo.rc}</span>}
              </div>
            </div>
            <div className="border-b border-dashed border-gray-300 pb-2 mb-2 text-[10px]">
              <p>ID: #123456</p>
              <p>Date: 29/03/2026</p>
            </div>
            <table className="w-full text-left mb-4">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-1">{t.product}</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1">Produit Exemple x1</td>
                  <td className="py-1 text-right">100.00 DH</td>
                </tr>
              </tbody>
            </table>
              <div className="text-right font-bold pt-2 border-t border-gray-200 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>{t.total_ht}:</span>
                <span>83.33 DH</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>{t.total_tva} (20%):</span>
                <span>16.67 DH</span>
              </div>
              <div className="flex justify-between text-sm pt-1 border-t border-gray-100">
                <span>{t.total_ttc}:</span>
                <span style={{ color: invoiceSettings.primaryColor }}>100.00 DH</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
