import { useEffect, useState } from 'react';
import { Redirect, useLocation } from 'wouter';
import { withUiBase } from '@/lib/paths';

interface AdminProtectedRouteProps {
  component: React.ComponentType;
}

const AdminProtectedRoute = ({ component: Component }: AdminProtectedRouteProps) => {
  const [, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Verificar si el usuario está autenticado como administrador
    const adminAuthenticated = sessionStorage.getItem('adminAuthenticated') === 'true';
    setIsAuthenticated(adminAuthenticated);
  }, []);

  // Mientras se verifica la autenticación
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Si no está autenticado, redirigir a la página de login de administrador
  if (!isAuthenticated) {
    return <Redirect to={withUiBase("/admin-login")} />;
  }

  // Si está autenticado, mostrar el componente
  return <Component />;
};

export default AdminProtectedRoute;