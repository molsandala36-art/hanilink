import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import POS from './pages/POS';
import SalesHistory from './pages/SalesHistory';
import Users from './pages/Users';
import AnalyticsPage from './pages/AnalyticsPage';
import AIInsights from './pages/AIInsights';
import Settings from './pages/Settings';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Expenses from './pages/Expenses';
import BusinessDocuments from './pages/BusinessDocuments';
import ActivationScreen from './pages/ActivationScreen';
import ClientsManagement from './pages/ClientsManagement';
import CreditsManagement from './pages/CreditsManagement';
import ReturnsManagement from './pages/ReturnsManagement';
import Layout from './components/Layout';
import { getDeviceIdentity } from './lib/hwid';
import { getBackendSetupIssue, isLicenseEnforcementEnabled, isSupabaseConfigured } from './lib/backend';
import { CurrentAppUser, getStoredCurrentUser, normalizeCurrentUser } from './lib/currentUser';
import api from './services/api';
import { getCurrentSupabaseUserProfile, getStoredSupabaseSession, getSupabaseClient, setCachedSupabaseSession, signOutFromSupabase } from './services/supabase';

const ProtectedRoute = ({ children, roles, currentUser }: { children: React.ReactNode, roles: string[], currentUser: CurrentAppUser | null }) => {
  const userRole = currentUser?.role || 'employee';
  if (!roles.includes(userRole)) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
};

const LicenseGuard = ({ children }: { children: React.ReactNode }) => {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    if (!isLicenseEnforcementEnabled) {
      setIsActivated(true);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return;
      setSetupError("La verification de licence prend trop de temps. Reessaie dans quelques secondes.");
      setIsActivated(false);
      setLoading(false);
    }, 12000);

    const checkLicense = async () => {
      const token = localStorage.getItem('token');
      const hasLocalLicenseMarker = localStorage.getItem('hani_license_active') === 'true';
      if (!token) {
        window.clearTimeout(timeoutId);
        setIsActivated(false);
        setLoading(false);
        return;
      }

      if (!hasLocalLicenseMarker) {
        window.clearTimeout(timeoutId);
        setIsActivated(false);
        setLoading(false);
        return;
      }

      const backendSetupIssue = getBackendSetupIssue();
      if (backendSetupIssue) {
        window.clearTimeout(timeoutId);
        setSetupError(backendSetupIssue);
        setLoading(false);
        return;
      }

      try {
        const identity = await getDeviceIdentity();
        const res = await api.post('/license/verify', identity);
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setIsActivated(res.data.active);
      } catch (err: any) {
        if (!isMounted) return;
        window.clearTimeout(timeoutId);
        setSetupError(err?.response?.data?.message || err?.message || 'Verification de licence impossible pour le moment.');
        setIsActivated(false);
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    void checkLicense();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading license...</div>;
  if (setupError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-xl w-full rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900 shadow-sm">
          <h1 className="text-xl font-bold">Configuration backend requise</h1>
          <p className="mt-3 text-sm leading-6">{setupError}</p>
        </div>
      </div>
    );
  }
  if (!isActivated) return <ActivationScreen onActivated={() => setIsActivated(true)} />;

  return <>{children}</>;
};

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!localStorage.getItem('token'));
  const [currentUser, setCurrentUser] = useState<CurrentAppUser | null>(() => getStoredCurrentUser());

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      return;
    }

    const restoreSupabaseSession = async () => {
      try {
        const session = await getStoredSupabaseSession();
        if (session?.user) {
          setCachedSupabaseSession(session);
          localStorage.setItem('token', session.access_token);
          const profile = await getCurrentSupabaseUserProfile(session.user);
          localStorage.setItem('user', JSON.stringify(profile));
          setCurrentUser(normalizeCurrentUser(profile));
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setCurrentUser(null);
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error(err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    };

    void restoreSupabaseSession();

    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setCachedSupabaseSession(session);
      if (session?.user) {
        localStorage.setItem('token', session.access_token);
        try {
          const profile = await getCurrentSupabaseUserProfile(session.user);
          localStorage.setItem('user', JSON.stringify(profile));
          setCurrentUser(normalizeCurrentUser(profile));
        } catch (err) {
          console.error(err);
        }
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setCurrentUser(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleStorageChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
      setCurrentUser(getStoredCurrentUser());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (token: string, user: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setCurrentUser(normalizeCurrentUser(user));
    setIsAuthenticated(true);
  };

  const logout = async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('hani_license_active');
    setCurrentUser(null);
    setIsAuthenticated(false);

    if (isSupabaseConfigured()) {
      try {
        await signOutFromSupabase();
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login onLogin={login} /> : <Navigate to="/" />} />
        <Route path="/register" element={!isAuthenticated ? <Register onLogin={login} /> : <Navigate to="/" />} />
        <Route path="/forgot-password" element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/" />} />
        
          <Route path="/" element={
            isAuthenticated ? (
              <LicenseGuard>
                <Layout onLogout={logout} currentUser={currentUser} />
              </LicenseGuard>
            ) : <Navigate to="/login" />
          }>
            <Route index element={<Dashboard />} />
            <Route path="products" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <Products />
              </ProtectedRoute>
            } />
            <Route path="suppliers" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <Suppliers />
              </ProtectedRoute>
            } />
            <Route path="purchase-orders" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <PurchaseOrders />
              </ProtectedRoute>
            } />
            <Route path="expenses" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <Expenses />
              </ProtectedRoute>
            } />
            <Route path="documents" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <BusinessDocuments />
              </ProtectedRoute>
            } />
            <Route path="pos" element={<POS />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="analytics" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="ai-insights" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <AIInsights />
              </ProtectedRoute>
            } />
            <Route path="clients" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <ClientsManagement />
              </ProtectedRoute>
            } />
            <Route path="credits" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <CreditsManagement />
              </ProtectedRoute>
            } />
            <Route path="returns" element={
              <ProtectedRoute roles={['admin', 'employee']} currentUser={currentUser}>
                <ReturnsManagement />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="users" element={
              <ProtectedRoute roles={['admin']} currentUser={currentUser}>
                <Users />
              </ProtectedRoute>
            } />
          </Route>
      </Routes>
    </Router>
  );
}

export default App;
