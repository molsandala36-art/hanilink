import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Brain,
  ClipboardList,
  FileText,
  History,
  Languages,
  LayoutDashboard,
  Layers3,
  LogOut,
  Menu,
  Moon,
  Package,
  Settings,
  ShoppingCart,
  Store,
  Sun,
  Truck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { Language, translations } from '../lib/translations';

interface LayoutProps {
  onLogout: () => void;
}

const Layout = ({ onLogout }: LayoutProps) => {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return true;
  });

  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const t = translations[language];
  const isPosRoute = location.pathname === '/pos';

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncViewportMode = () => {
      const mobile = mediaQuery.matches;
      setIsMobile(mobile);
      setIsSidebarOpen(!mobile);
    };

    syncViewportMode();
    mediaQuery.addEventListener('change', syncViewportMode);

    return () => mediaQuery.removeEventListener('change', syncViewportMode);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

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

  const filteredNavigation = navigation.filter((item) => item.roles.includes(user.role || 'employee'));

  const toggleLanguage = () => {
    setLanguage((current) => (current === 'fr' ? 'ar' : 'fr'));
  };

  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  const sidebarExpanded = isMobile || isSidebarOpen;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 transition-colors duration-300 dark:bg-gray-900">
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={cn(
          'min-h-0 overflow-hidden bg-white dark:bg-gray-800 dark:border-gray-700',
          isMobile
            ? [
                'fixed inset-y-0 z-40 w-72 max-w-[85vw] border shadow-2xl transition-transform duration-300',
                language === 'ar'
                  ? (isSidebarOpen ? 'right-0 translate-x-0' : 'right-0 translate-x-full')
                  : (isSidebarOpen ? 'left-0 translate-x-0' : 'left-0 -translate-x-full'),
              ]
            : [
                'flex h-screen shrink-0 flex-col border-r transition-all duration-300',
                isSidebarOpen ? 'w-64' : 'w-20',
                language === 'ar' ? 'border-l border-r-0' : 'border-r',
              ]
        )}
      >
        <div className="flex shrink-0 items-center gap-3 p-6">
          <div className="rounded-lg bg-orange-500 p-2">
            <Store className="h-6 w-6 text-white" />
          </div>
          {sidebarExpanded && <span className="text-xl font-bold text-gray-800 dark:text-white">HaniLink</span>}
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
          {filteredNavigation.map((item) => {
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={closeSidebar}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                  isActive
                    ? 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                )}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarExpanded && <span className="font-medium">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className={cn('mb-4 flex items-center gap-3', !sidebarExpanded && 'justify-center')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 font-bold text-orange-600 dark:bg-orange-900/40 dark:text-orange-400">
              {user.name?.[0]?.toUpperCase()}
            </div>
            {sidebarExpanded && (
              <div className="overflow-hidden">
                <p className="truncate text-sm font-medium text-gray-800 dark:text-white">{user.name}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {user.shopName} • <span className="capitalize">{user.role}</span>
                </p>
              </div>
            )}
          </div>

          <button
            onClick={onLogout}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/20 dark:hover:text-red-400',
              !sidebarExpanded && 'justify-center'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarExpanded && <span className="font-medium">{t.logout}</span>}
          </button>
        </div>
      </aside>

      <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              onClick={() => setIsSidebarOpen((current) => !current)}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
            >
              {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <span className="hidden truncate text-sm italic text-gray-500 dark:text-gray-400 lg:inline">
              {language === 'ar' ? `مرحبا بك في المغرب، ${user.shopName}` : `Bienvenue au Maroc, ${user.shopName}`}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              title={language === 'ar' ? 'Changer la langue' : 'تغيير اللغة'}
            >
              <Languages className="h-5 w-5" />
              <span className="text-xs font-bold">{language === 'ar' ? 'FR' : 'AR'}</span>
            </button>

            <button
              onClick={() => setIsDarkMode((current) => !current)}
              className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
              title={isDarkMode ? 'Passer au mode clair' : 'Passer au mode sombre'}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            <div className="mx-1 hidden h-8 w-px bg-gray-200 dark:bg-gray-700 sm:block" />

            <div className="flex items-center gap-3">
              <div className="hidden text-right md:block">
                <p className="text-sm font-bold text-gray-900 dark:text-white">{user.name}</p>
                <p className="text-xs capitalize text-gray-500 dark:text-gray-400">
                  {user.role} - {user.shopName}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 font-bold text-white shadow-lg shadow-orange-200 dark:shadow-none">
                {user.name?.[0]?.toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        <div
          className={cn(
            'min-w-0 flex-1',
            isPosRoute ? 'min-h-0 overflow-hidden p-3 sm:p-4 lg:p-6' : 'overflow-auto p-4 sm:p-6 lg:p-8'
          )}
        >
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;
