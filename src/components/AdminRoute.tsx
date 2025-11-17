import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface AdminRouteProps {
  children: ReactNode;
}

export const AdminRoute = ({ children }: AdminRouteProps) => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkIsAdmin = useAuthStore((state) => state.isAdmin);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!checkIsAdmin()) {
    return <Navigate to="/" replace state={{ from: location.pathname, reason: 'not-authorized' }} />;
  }

  return <>{children}</>;
};
