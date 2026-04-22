import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Printer, Save, CheckCircle2, Upload, X as CloseIcon, Building2, Database, RefreshCw } from 'lucide-react';
import { translations, Language } from '../lib/translations';
import api from '../services/api';
import { cn, formatDate, getDefaultVatRate } from '../lib/utils';

interface InvoiceSettings {
  logoUrl: string;
  fontSize: string;
  primaryColor: string;
}

interface UserLegalInfo {
  shopName: string;
  ice: string;
  if: string;
  rc: string;
  address: string;
}

interface SyncStatus {
  localDbPath: string;
  mongoConnected: boolean;
  fileSizeBytes: number;
  lastPullAt: string | null;
  lastPushAt: string | null;
  lastDrivePullAt: string | null;
  lastDrivePushAt: string | null;
  collectionCounts: Record<string, number>;
  googleDriveFolderPath: string;
  googleDriveFilePath: string;
  googleDriveFileExists: boolean;
  googleDriveFileSizeBytes: number;
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
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => {
    const saved = localStorage.getItem('invoiceSettings') ?? localStorage.getItem('receiptSettings');
    return saved ? JSON.parse(saved) : {
      logoUrl: '',
      fontSize: '14px',
      primaryColor: '#f97316' // orange-500
    };
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSavingLegal, setIsSavingLegal] = useState(false);
  const [isSavingVat, setIsSavingVat] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [defaultVatRate, setDefaultVatRate] = useState(getDefaultVatRate);
  const [googleDriveFolderPath, setGoogleDriveFolderPath] = useState('');

  const t = translations[language];

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
      setGoogleDriveFolderPath(res.data.googleDriveFolderPath || '');
    } catch (err) {
      console.error('Failed to fetch sync status', err);
    }
  };

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('invoiceSettings', JSON.stringify(invoiceSettings));
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
      const products = Array.isArray(productsRes.data) ? productsRes.data : [];

      await Promise.all(
        products.map((product: any) =>
          api.put(`/products/${product._id}`, {
            name: product.name,
            price: product.price,
            purchasePrice: product.purchasePrice,
            stock: product.stock,
            category: product.category,
            tvaRate: parsedVatRate,
            supplierTva: parsedVatRate,
            place: product.place || '',
            photoUrl: product.photoUrl || '',
            supplierId: product.supplierId || ''
          })
        )
      );

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

  const saveGoogleDriveSync = async () => {
    setIsSyncLoading(true);
    try {
      await api.post('/sync/google-drive/config', { googleDriveFolderPath });
      await fetchSyncStatus();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Google Drive config failed', err);
      alert(language === 'ar' ? 'فشل حفظ إعداد Google Drive' : 'Échec de l\'enregistrement du dossier Google Drive');
    } finally {
      setIsSyncLoading(false);
    }
  };

  const runGoogleDriveSync = async (mode: 'pull' | 'push') => {
    setIsSyncLoading(true);
    try {
      await api.post(`/sync/google-drive/${mode}`);
      await fetchSyncStatus();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error('Google Drive sync failed', err);
      alert(language === 'ar' ? 'فشلت مزامنة Google Drive' : 'La synchronisation Google Drive a échoué');
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
            {t.local_db_sync}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t.mongo_connected}</p>
              <p className={cn("font-bold", syncStatus?.mongoConnected ? "text-green-600" : "text-red-600")}>
                {syncStatus?.mongoConnected ? 'Yes' : 'No'}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t.local_file_size}</p>
              <p className="font-bold text-gray-900 dark:text-white">
                {syncStatus ? `${(syncStatus.fileSizeBytes / 1024).toFixed(2)} KB` : '-'}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t.last_pull}</p>
              <p className="font-bold text-gray-900 dark:text-white">
                {syncStatus?.lastPullAt ? formatDate(syncStatus.lastPullAt) : '-'}
              </p>
            </div>
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t.last_push}</p>
              <p className="font-bold text-gray-900 dark:text-white">
                {syncStatus?.lastPushAt ? formatDate(syncStatus.lastPushAt) : '-'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => runSync('pull')}
              disabled={isSyncLoading}
              className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isSyncLoading && "animate-spin")} />
              {t.sync_pull}
            </button>
            <button
              onClick={() => runSync('push')}
              disabled={isSyncLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className={cn("w-4 h-4", isSyncLoading && "animate-spin")} />
              {t.sync_push}
            </button>
            <button
              onClick={fetchSyncStatus}
              disabled={isSyncLoading}
              className="px-4 py-2 rounded-lg font-bold border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all"
            >
              {t.sync_status}
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-400" />
            Google Drive Sync
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'مسار مجلد Google Drive' : 'Chemin du dossier Google Drive'}
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder={language === 'ar' ? 'مثال: C:\\Users\\Nom\\Google Drive\\HaniLink' : 'Ex: C:\\Users\\Nom\\Google Drive\\HaniLink'}
                  value={googleDriveFolderPath}
                  onChange={(e) => setGoogleDriveFolderPath(e.target.value)}
                  className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                />
                <button
                  type="button"
                  onClick={saveGoogleDriveSync}
                  disabled={isSyncLoading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold transition-all"
                >
                  {t.save_settings}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {language === 'ar'
                  ? 'استعمل مجلداً محلياً تتم مزامنته مسبقاً بواسطة تطبيق Google Drive for Desktop.'
                  : 'Utilisez un dossier local déjà synchronisé par Google Drive for Desktop.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {language === 'ar' ? 'Fichier Drive' : 'Fichier Drive'}
                </p>
                <p className={cn('font-bold break-all', syncStatus?.googleDriveFileExists ? 'text-green-600' : 'text-gray-500')}>
                  {syncStatus?.googleDriveFilePath || '-'}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {language === 'ar' ? 'Taille fichier Drive' : 'Taille fichier Drive'}
                </p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {syncStatus?.googleDriveFileSizeBytes ? `${(syncStatus.googleDriveFileSizeBytes / 1024).toFixed(2)} KB` : '-'}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {language === 'ar' ? 'Dernier import Drive' : 'Dernier import Drive'}
                </p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {syncStatus?.lastDrivePullAt ? formatDate(syncStatus.lastDrivePullAt) : '-'}
                </p>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {language === 'ar' ? 'Dernier export Drive' : 'Dernier export Drive'}
                </p>
                <p className="font-bold text-gray-900 dark:text-white">
                  {syncStatus?.lastDrivePushAt ? formatDate(syncStatus.lastDrivePushAt) : '-'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => runGoogleDriveSync('push')}
                disabled={isSyncLoading || !googleDriveFolderPath.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={cn('w-4 h-4', isSyncLoading && 'animate-spin')} />
                {language === 'ar' ? 'Local vers Google Drive' : 'Local vers Google Drive'}
              </button>
              <button
                onClick={() => runGoogleDriveSync('pull')}
                disabled={isSyncLoading || !googleDriveFolderPath.trim()}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={cn('w-4 h-4', isSyncLoading && 'animate-spin')} />
                {language === 'ar' ? 'Google Drive vers Local' : 'Google Drive vers Local'}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Printer className="w-5 h-5 text-gray-400" />
            {language === 'ar' ? 'معاينة الفاتورة' : 'Aperçu de la facture'}
          </h3>
          <div 
            className="border border-gray-200 dark:border-gray-700 p-6 rounded-lg bg-white text-black mx-auto max-w-[300px] shadow-inner"
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
