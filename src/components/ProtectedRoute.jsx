import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route and redirects unauthenticated users to /login.
 *
 * Role comparison is case-insensitive:
 *   PocketBase stores "Doctor" / "Receptionist" (capitalised)
 *   but route props use lowercase ("doctor" / "receptionist").
 */
export default function ProtectedRoute({ children, role }) {
  const { user, loading, getDashboardPath } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display:'flex', height:'100vh', alignItems:'center', justifyContent:'center', backgroundColor:'#f8fafc' }}>
        <div style={{ textAlign:'center' }}>
          <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#0f766e', borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
          <span style={{ color:'#64748b', fontSize:'0.875rem', fontFamily:'Inter, system-ui, sans-serif' }}>Loading…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Not authenticated → go to login
  if (!user) return <Navigate to="/login" replace />;

  // Role check (case-insensitive)
  // Only redirect if the user's role is set and doesn't match the required role
  const userRole = (user.role ?? '').toLowerCase();
  const requiredRole = (role ?? '').toLowerCase();

  if (requiredRole && userRole && userRole !== requiredRole) {
    const dest = getDashboardPath(user);
    // Guard against redirecting to the same page (would cause an infinite loop)
    if (dest !== location.pathname) {
      return <Navigate to={dest} replace />;
    }
  }

  return children;
}
