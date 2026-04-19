import { Link, useLocation, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History, 
  LogOut, 
  Store,
  Menu,
  X,
  Sun,
  Moon,
  Users,
  BarChart3,
  FileText,
  Languages,
  Brain,
  Settings,
  Truck,
  ClipboardList,
  Wallet,
  Layers3
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { translations, Language } from '../lib/translations';

interface LayoutProps {
  onLogout: () => void;
}

const Layout = ({ onLogout }: LayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [language, setLanguage] = useState<Language>(() => {
    return (localStorage.getItem('language') as Language) || 'fr';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) return savedTheme === 'dark';
      // Default to dark mode if no preference is saved
      return true;
    }
    return true;
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';
  const t = translations[language];

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    localStorage.setItem('language', language);
  }, [language]);

  const navigation = [
    { name: t.dashboard, href: '/', icon: LayoutDashboard, roles: ['admin', 'employee'] },
    { name: t.analytics, href: '/analytics', icon: BarChart3, roles: ['admin'] },
    { name: t.products, href: '/products', icon: Package, roles: ['admin'] },
    { name: t.suppliers, href: '/suppliers', icon: Truck, roles: ['admin'] },
    { name: t.purchase_orders, href: '/purchase-orders', icon: ClipboardList, roles: ['admin'] },
    { name: t.expenses, href: '/expenses', icon: Wallet, roles: ['admin'] },
    { name: t.documents, href: '/documents', icon: FileText, roles: ['admin'] },
    { name: t.pos, href: '/pos', icon: ShoppingCart, roles: ['admin', 'employee'] },
    { name: t.sales, href: '/sales', icon: History, roles: ['admin', 'employee'] },
    { name: t.ai_insights, href: '/ai-insights', icon: Brain, roles: ['admin'] },
    { name: 'SaaS Clients', href: '/saas-tenants', icon: Layers3, roles: ['admin'] },
    { name: t.settings, href: '/settings', icon: Settings, roles: ['admin'] },
    { name: t.users, href: '/users', icon: Users, roles: ['admin'] },
  ];

  const filteredNavigation = navigation.filter(item => item.roles.includes(user.role || 'employee'));
  const isPosRoute = location.pathname === '/pos';

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'fr' ? 'ar' : 'fr');
  };

  return (
    <div className="h-screen overflow-hidden bg-gray-50 dark:bg-gray-900 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside 
        className={cn(
          "h-screen bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex flex-col shrink-0 overflow-hidden",
          isSidebarOpen ? "w-64" : "w-20",
          language === 'ar' ? "border-l border-r-0" : "border-r"
        )}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="bg-orange-500 p-2 rounded-lg">
            <Store className="text-white w-6 h-6" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl text-gray-800 dark:text-white">HaniLink</span>}
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                  isActive 
                    ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400" 
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {isSidebarOpen && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className={cn("flex items-center gap-3 mb-4", !isSidebarOpen && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold">
              {user.name?.[0]?.toUpperCase()}
            </div>
            {isSidebarOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1">
                  {user.shopName} • <span className="capitalize">{user.role}</span>
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors",
              !isSidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="font-medium">{t.logout}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-8 transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400 italic hidden md:inline">
              {language === 'ar' ? `مرحباً بك في المغرب، ${user.shopName}` : `Bienvenue au Maroc, ${user.shopName}`}
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleLanguage}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors flex items-center gap-2"
              title={language === 'ar' ? "Changer la langue" : "تغيير اللغة"}
            >
              <Languages className="w-5 h-5" />
              <span className="text-xs font-bold">{language === 'ar' ? 'FR' : 'AR'}</span>
            </button>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
              title={isDarkMode ? "Passer au mode clair" : "Passer au mode sombre"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role} - {user.shopName}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shadow-lg shadow-orange-200 dark:shadow-none">
                {user.name?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>
        
        <div className={cn(
          "flex-1 min-w-0",
          isPosRoute ? "overflow-hidden min-h-0 p-4 lg:p-6" : "overflow-auto p-8"
        )}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
