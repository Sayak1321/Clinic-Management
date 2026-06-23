import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { lazy, Suspense } from 'react';

// Pages — lazy-loaded for smaller initial bundle
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ReceptionistDash = lazy(() => import('./pages/ReceptionistDashboard'));
const DoctorDash = lazy(() => import('./pages/DoctorDashboard'));

function Loader() {
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#0f766e', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <span style={{ color: '#64748b', fontSize: '0.875rem', fontFamily: 'Inter, system-ui, sans-serif' }}>Loading…</span>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

import { Link } from 'react-router-dom';

function PortalHub() {
  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(145deg, #0f4c3a 0%, #0f766e 40%, #134e4a 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: 'white',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative circles */}
      <div style={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ position: 'absolute', bottom: 80, left: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

      <div style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} style={{ width: 24, height: 24 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>CliniQ</h1>
        </div>
        <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.95rem', margin: 0 }}>Clinic Portal Selection Hub</p>
      </div>

      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '800px', width: '100%', position: 'relative', zIndex: 1 }}>

        {/* Receptionist Portal Card */}
        <Link to="/receptionist" style={{ textDecoration: 'none', color: 'inherit', flex: '1 1 300px', maxWidth: '340px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            transition: 'all 0.2s',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: '16px', background: '#2dd4bf', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#0f4c3a' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 30, height: 30 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '10px' }}>Receptionist Portal</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
              Register walk-in patients, issue queue tokens, and generate invoice bills.
            </p>
          </div>
        </Link>

        {/* Doctor Portal Card */}
        <Link to="/doctor" style={{ textDecoration: 'none', color: 'inherit', flex: '1 1 300px', maxWidth: '340px' }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            border: '1.5px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            padding: '32px',
            textAlign: 'center',
            transition: 'all 0.2s',
            cursor: 'pointer',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}
            onMouseOver={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
              e.currentTarget.style.transform = 'translateY(-4px)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ width: 60, height: 60, borderRadius: '16px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: 'white' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ width: 30, height: 30 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '10px' }}>Doctor Portal</h2>
            <p style={{ color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem', lineHeight: '1.6', margin: 0 }}>
              View waiting queue, consult patients, advise medications, and check records.
            </p>
          </div>
        </Link>

      </div>
    </div>
  );
}

function AdminPlaceholder() {
  const { user, logout } = useAuth();
  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#7c3aed' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 32, height: 32 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Admin Portal</h1>
        <p style={{ color: '#64748b', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: 8 }}>
          Welcome, <strong>{user?.name || user?.email}</strong>
        </p>
        <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginBottom: 24 }}>
          The admin dashboard is coming soon. You can manage database collections in your Supabase project directly.
        </p>
        <button onClick={logout} style={{ padding: '10px 24px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
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
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Root → Landing selection hub */}
          <Route path="/" element={<PortalHub />} />

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
