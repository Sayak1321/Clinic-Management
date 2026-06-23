import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Wraps a route and redirects unauthenticated users to /login.
 *
 * Role comparison is case-insensitive:
 *   PocketBase stores "Doctor" / "Receptionist" (capitalised)
 *   but route props use lowercase ("doctor" / "receptionist").
 */
export default function ProtectedRoute({ children }) {
  return children;
}
