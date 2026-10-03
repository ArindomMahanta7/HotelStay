import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types";

export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { isAuthenticated, user, hydrate } = useAuth();
  const location = useLocation();

  if (!isAuthenticated && (localStorage.getItem("hs_token") || localStorage.getItem("hs_user"))) {
    hydrate();
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}