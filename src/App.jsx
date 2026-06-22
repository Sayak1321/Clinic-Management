import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { lazy, Suspense } from 'react';

// Pages — lazy-loaded for smaller initial bundle
const Login      = lazy(() => import('./pages/Login'));
const Register   = lazy(() => import('./pages/Register'));
const ReceptionistDash = lazy(() => import('./pages/ReceptionistDashboard'));
const DoctorDash = lazy(() => import('./pages/DoctorDashboard'));

function Loader() {
  return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#f8fafc' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#0f766e', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <span style={{ color:'#64748b', fontSize:'0.875rem', fontFamily:'Inter, system-ui, sans-serif' }}>Loading…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function RootRedirect() {
  const { user, loading, getDashboardPath } = useAuth();
  if (loading) return <Loader />;
  if (!user)   return <Navigate to="/login" replace />;
  return <Navigate to={getDashboardPath(user)} replace />;
}

function AdminPlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', background:'#f8fafc', fontFamily:'Inter, system-ui, sans-serif' }}>
      <div style={{ textAlign:'center', maxWidth:400, padding:32 }}>
        <div style={{ width:64, height:64, borderRadius:16, background:'#f5f3ff', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color:'#7c3aed' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width:32, height:32 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'#0f172a', marginBottom:8 }}>Admin Portal</h1>
        <p style={{ color:'#64748b', fontSize:'0.875rem', lineHeight:1.6, marginBottom:8 }}>
          Welcome, <strong>{user?.name || user?.email}</strong>
        </p>
        <p style={{ color:'#94a3b8', fontSize:'0.8rem', marginBottom:24 }}>
          The admin dashboard is coming soon. You can manage PocketBase collections directly at{' '}
          <a href="http://127.0.0.1:8090/_/" target="_blank" rel="noreferrer" style={{ color:'#7c3aed' }}>
            127.0.0.1:8090/_/
          </a>
        </p>
        <button onClick={logout} style={{ padding:'10px 24px', background:'#7c3aed', color:'white', border:'none', borderRadius:8, fontSize:'0.875rem', fontWeight:600, cursor:'pointer' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root → smart redirect based on role */}
          <Route path="/" element={<RootRedirect />} />

          {/* Protected — receptionist */}
          <Route path="/receptionist" element={
            <ProtectedRoute role="receptionist">
              <ReceptionistDash />
            </ProtectedRoute>
          } />

          {/* Protected — doctor */}
          <Route path="/doctor" element={
            <ProtectedRoute role="doctor">
              <DoctorDash />
            </ProtectedRoute>
          } />

          {/* Protected — admin */}
          <Route path="/admin" element={
            <ProtectedRoute role="admin">
              <AdminPlaceholder />
            </ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
