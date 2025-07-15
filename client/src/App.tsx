import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { UserProvider, useUser } from "@/context/UserContext";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import MapPage from "@/pages/MapPage";
import RegistrationPage from "@/pages/RegistrationPage";
import AdminPage from "@/pages/AdminPage";
import AdminLoginPage from "@/pages/AdminLoginPage";
import InformeAnaliticaPage from "@/pages/InformeAnaliticaPage";
import UnlockPage from "@/pages/UnlockPage";
import QRUnlockHandler from "@/pages/QRUnlockHandler";
import RankingPage from "@/pages/RankingPage";
import { Loader2 } from "lucide-react";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { useEffect } from "react";
import { login } from "@/lib/api";

// Componente para redirigir usuarios ya logueados
const ProtectedLoginRoute = () => {
  const { currentUser } = useUser();

  // Si hay un usuario logueado, redirigir al mapa
  if (currentUser) {
    return <Redirect to="/map" />;
  }

  // Si no hay usuario, mostrar página de login
  return <AuthPage />;
};

// Componente para recuperar sesión automáticamente
const SessionRecovery = () => {
  const { currentUser, setCurrentUser } = useUser();
  
  useEffect(() => {
    const recoverSession = async () => {
      // Solo intentar recuperar si no hay usuario actual
      if (!currentUser) {
        try {
          const savedUser = localStorage.getItem('currentUser');
          const lastDocument = localStorage.getItem('lastDocument');
          
          if (savedUser && lastDocument) {
            const parsedUser = JSON.parse(savedUser);
            console.log('Recuperando sesión para:', parsedUser.documentNumber);
            
            // Intentar validar la sesión con el servidor
            try {
              const response = await login(parsedUser.documentNumber);
              if (response.user) {
                setCurrentUser(response.user);
                console.log('Sesión recuperada exitosamente');
              }
            } catch (error) {
              console.log('Error al validar sesión, limpiando datos:', error);
              // Si falla, limpiar datos obsoletos
              localStorage.removeItem('currentUser');
              localStorage.removeItem('lastDocument');
            }
          }
        } catch (error) {
          console.error('Error al recuperar sesión:', error);
        }
      }
    };
    
    recoverSession();
  }, [currentUser, setCurrentUser]);
  
  return null; // No renderiza nada
};

function Router() {
  return (
    <>
      <SessionRecovery />
      <Switch>
        <Route path="/" component={ProtectedLoginRoute} />
        <Route path="/auth" component={ProtectedLoginRoute} />
        <Route path="/register" component={RegistrationPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/unlock" component={QRUnlockHandler} />
        <Route path="/ranking" component={RankingPage} />
        <Route path="/admin-login" component={AdminLoginPage} />
        <Route path="/admin">
          <AdminProtectedRoute component={AdminPage} />
        </Route>
        <Route path="/admin/informe-analitica">
          <AdminProtectedRoute component={InformeAnaliticaPage} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <Router />
        <Toaster />
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
