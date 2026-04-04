import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Key, Loader2, AlertCircle, CheckCircle2, Languages } from 'lucide-react';
import { getHWID } from '../lib/hwid';
import api from '../services/api';
import { translations, Language } from '../lib/translations';

interface ActivationScreenProps {
  onActivated: () => void;
}

const ActivationScreen = ({ onActivated }: ActivationScreenProps) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [hwid, setHwid] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const t = translations[language];

  useEffect(() => {
    const fetchHwid = async () => {
      const id = await getHWID();
      setHwid(id);
    };
    fetchHwid();
  }, []);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const trimmedKey = licenseKey.trim().toUpperCase();
      const res = await api.post('/license/activate', {
        key: trimmedKey,
        hwid
      });

      if (res.data.success) {
        setSuccess(true);
        localStorage.setItem('hani_license_active', 'true');
        setTimeout(() => {
          onActivated();
        }, 2000);
      } else {
        setError('Activation failed. Please check your key.');
      }
    } catch (err: any) {
      console.error('Activation Error:', err);
      setError(err.response?.data?.message || 'Activation failed. Please check your key.');
    } finally {
      setLoading(false);
    }
  };

  const toggleLanguage = () => {
    const newLang = language === 'fr' ? 'ar' : 'fr';
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <button 
          onClick={toggleLanguage}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all dark:text-white"
        >
          <Languages className="w-4 h-4" />
          {language === 'fr' ? 'العربية' : 'Français'}
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-orange-500/10 p-8 border border-gray-100 dark:border-gray-800"
      >
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-10 h-10 text-orange-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {language === 'fr' ? 'Activation du Logiciel' : 'تنشيط البرنامج'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {language === 'fr' ? 'Veuillez entrer votre clé de licence pour continuer.' : 'يرجى إدخال مفتاح الترخيص الخاص بك للمتابعة.'}
          </p>
        </div>

        <form onSubmit={handleActivate} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {language === 'fr' ? 'Clé de Licence' : 'مفتاح الترخيص'}
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white transition-all font-mono tracking-wider"
                required
              />
            </div>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              {language === 'fr' ? 'ID Matériel (HWID)' : 'معرف الجهاز (HWID)'}
            </p>
            <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
              {hwid || 'Generating...'}
            </p>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl flex items-center gap-3 text-sm"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              {error}
            </motion.div>
          )}

          {success && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-xl flex items-center gap-3 text-sm"
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {language === 'fr' ? 'Activation réussie ! Redirection...' : 'تم التنشيط بنجاح! جاري التحويل...'}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 text-white font-bold rounded-xl transition-all shadow-lg shadow-orange-200 dark:shadow-none flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'fr' ? 'Activer Maintenant' : 'تنشيط الآن')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            {language === 'fr' ? 'Besoin d\'aide ? Contactez le support.' : 'هل تحتاج إلى مساعدة؟ اتصل بالدعم.'}
          </p>
          <p className="font-bold text-orange-500 mt-1">support@hanilink.com</p>
        </div>
      </motion.div>
    </div>
  );
};

export default ActivationScreen;
