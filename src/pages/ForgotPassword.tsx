import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Store, Loader2, ArrowLeft, Mail, CheckCircle, Languages } from 'lucide-react';
import { Language } from '../lib/translations';
import { cn } from '../lib/utils';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'fr';
  });

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
  }, [language]);

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'fr' ? 'ar' : 'fr');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Mocking success for now
      await new Promise(resolve => setTimeout(resolve, 1500));
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.message || (language === 'ar' ? 'حدث خطأ ما' : 'Une erreur est survenue'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700">
        <div className="flex justify-end mb-4">
          <button
            onClick={toggleLanguage}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors flex items-center gap-2"
          >
            <Languages className="w-4 h-4" />
            <span className="text-xs font-bold">{language === 'ar' ? 'FR' : 'AR'}</span>
          </button>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="bg-orange-500 p-3 rounded-2xl mb-4">
            <Store className="text-white w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'هل نسيت كلمة السر؟' : 'Mot de passe oublié'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-center mt-2">
            {language === 'ar' 
              ? 'أدخل بريدك الإلكتروني لتلقي رابط إعادة التعيين' 
              : 'Entrez votre email pour recevoir un lien de réinitialisation'}
          </p>
        </div>

        {success ? (
          <div className="text-center space-y-6">
            <div className="flex justify-center">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {language === 'ar' ? 'تم إرسال البريد!' : 'Email envoyé !'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {language === 'ar'
                  ? `إذا كان هناك حساب لـ ${email}، فستتلقى التعليمات.`
                  : `Si un compte existe pour ${email}, vous recevrez des instructions.`}
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-orange-600 font-bold hover:underline"
            >
              <ArrowLeft className={cn("w-4 h-4", language === 'ar' && "rotate-180")} />
              {language === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Retour à la connexion'}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm font-medium">
                {error}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              </label>
              <div className="relative">
                <Mail className={cn(
                  "absolute top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400",
                  language === 'ar' ? "right-3" : "left-3"
                )} />
                <input
                  type="email"
                  required
                  className={cn(
                    "w-full py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white",
                    language === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
                  )}
                  placeholder={language === 'ar' ? 'بريدك@الإلكتروني.com' : 'votre@email.com'}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'ar' ? 'إرسال الرابط' : 'Envoyer le lien')}
            </button>
            <div className="text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 text-sm hover:text-orange-600 transition-colors"
              >
                <ArrowLeft className={cn("w-4 h-4", language === 'ar' && "rotate-180")} />
                {language === 'ar' ? 'العودة إلى تسجيل الدخول' : 'Retour à la connexion'}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
