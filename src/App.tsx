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
import AdminLicensing from './pages/AdminLicensing';
import ActivationScreen from './pages/ActivationScreen';
import Layout from './components/Layout';
import { getHWID } from './lib/hwid';
import { getBackendSetupIssue, isSupabaseConfigured } from './lib/backend';
import api from './services/api';
import { getStoredSupabaseSession, normalizeSupabaseUser, signOutFromSupabase, supabase } from './services/supabase';

const ProtectedRoute = ({ children, roles }: { children: React.ReactNode, roles: string[] }) => {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  if (!roles.includes(user.role || 'employee')) {
    return <Navigate to="/" />;
  }
  return <>{children}</>;
};

const LicenseGuard = ({ children }: { children: React.ReactNode }) => {
  const [isActivated, setIsActivated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupError, setSetupError] = useState('');

  useEffect(() => {
    if (isSupabaseConfigured) {
      setIsActivated(true);
      setLoading(false);
      return;
    }

    const checkLicense = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsActivated(false);
        setLoading(false);
        return;
      }

      const backendSetupIssue = getBackendSetupIssue();
      if (backendSetupIssue) {
        setSetupError(backendSetupIssue);
        setLoading(false);
        return;
      }

      try {
        const hwid = await getHWID();
        const res = await api.post('/license/verify', { hwid });
        setIsActivated(res.data.active);
      } catch (err) {
        setIsActivated(false);
      } finally {
        setLoading(false);
      }
    };

    checkLicense();
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

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return;
    }

    const restoreSupabaseSession = async () => {
      try {
        const session = await getStoredSupabaseSession();
        if (session?.user) {
          localStorage.setItem('token', session.access_token);
          localStorage.setItem('user', JSON.stringify(normalizeSupabaseUser(session.user)));
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error(err);
      }
    };

    void restoreSupabaseSession();

    const { data: listener } = supabase!.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        localStorage.setItem('token', session.access_token);
        localStorage.setItem('user', JSON.stringify(normalizeSupabaseUser(session.user)));
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
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
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const login = (token: string, user: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setIsAuthenticated(true);
  };

  const logout = async () => {
    if (isSupabaseConfigured) {
      try {
        await signOutFromSupabase();
      } catch (err) {
        console.error(err);
      }
    }

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('hani_license_active');
    setIsAuthenticated(false);
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
                <Layout onLogout={logout} />
              </LicenseGuard>
            ) : <Navigate to="/login" />
          }>
            <Route index element={<Dashboard />} />
            <Route path="products" element={
              <ProtectedRoute roles={['admin']}>
                <Products />
              </ProtectedRoute>
            } />
            <Route path="suppliers" element={
              <ProtectedRoute roles={['admin']}>
                <Suppliers />
              </ProtectedRoute>
            } />
            <Route path="purchase-orders" element={
              <ProtectedRoute roles={['admin']}>
                <PurchaseOrders />
              </ProtectedRoute>
            } />
            <Route path="expenses" element={
              <ProtectedRoute roles={['admin']}>
                <Expenses />
              </ProtectedRoute>
            } />
            <Route path="documents" element={
              <ProtectedRoute roles={['admin']}>
                <BusinessDocuments />
              </ProtectedRoute>
            } />
            <Route path="pos" element={<POS />} />
            <Route path="sales" element={<SalesHistory />} />
            <Route path="analytics" element={
              <ProtectedRoute roles={['admin']}>
                <AnalyticsPage />
              </ProtectedRoute>
            } />
            <Route path="ai-insights" element={
              <ProtectedRoute roles={['admin']}>
                <AIInsights />
              </ProtectedRoute>
            } />
            <Route path="settings" element={
              <ProtectedRoute roles={['admin']}>
                <Settings />
              </ProtectedRoute>
            } />
            <Route path="users" element={
              <ProtectedRoute roles={['admin']}>
                <Users />
              </ProtectedRoute>
            } />
            <Route path="admin/licensing" element={
              <ProtectedRoute roles={['admin']}>
                <AdminLicensing />
              </ProtectedRoute>
            } />
          </Route>
      </Routes>
    </Router>
  );
}

export default App;
