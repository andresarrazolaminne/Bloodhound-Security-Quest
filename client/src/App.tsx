import { Switch, Route, Redirect } from "wouter";
import { LegacyAdminTenantRedirect } from "@/components/LegacyAdminTenantRedirect";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { UserProvider, useUser } from "@/context/UserContext";
import { getCampaignSlugFromPath, setActiveCampaignSlug, withUiBase, UI_BASE_PATH, withUiCampaign } from "./lib/paths";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import MapPage from "@/pages/MapPage";
import RegistrationPage from "@/pages/RegistrationPage";
import AdminPage from "@/pages/AdminPage";
import AdminLoginPage from "@/pages/AdminLoginPage";

import QRUnlockHandler from "@/pages/QRUnlockHandler";
import RankingPage from "@/pages/RankingPage";
import AdminProtectedRoute from "@/components/AdminProtectedRoute";
import { useEffect, useLayoutEffect } from "react";
import { useLocation } from "wouter";
import { login } from "@/lib/api";

// Componente para redirigir usuarios ya logueados
const ProtectedLoginRoute = () => {
  const { currentUser } = useUser();

  // Si hay un usuario logueado, redirigir al mapa
  if (currentUser) {
    return <Redirect to={withUiCampaign("/map")} />;
  }

  // Si no hay usuario, mostrar página de login
  return <AuthPage />;
};

// Componente para recuperar sesión automáticamente
const SessionRecovery = () => {
  const { currentUser, setCurrentUser } = useUser();
  const [routerPath] = useLocation();

  useLayoutEffect(() => {
    const slug = getCampaignSlugFromPath(window.location.pathname);
    if (slug) setActiveCampaignSlug(slug);
  }, [routerPath]);

  useEffect(() => {
    const recoverSession = async () => {
      // Solo intentar recuperar si no hay usuario actual
      if (!currentUser) {
        try {
          const slug = getCampaignSlugFromPath(window.location.pathname);
          const scopedUser = slug
            ? localStorage.getItem(`currentUser:${slug}`)
            : localStorage.getItem("currentUser");
          const scopedDocument = slug
            ? localStorage.getItem(`lastDocument:${slug}`)
            : localStorage.getItem("lastDocument");
          
          if (scopedUser && scopedDocument) {
            const parsedUser = JSON.parse(scopedUser);
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
              if (slug) {
                localStorage.removeItem(`currentUser:${slug}`);
                localStorage.removeItem(`lastDocument:${slug}`);
              } else {
                localStorage.removeItem('currentUser');
                localStorage.removeItem('lastDocument');
              }
            }
          }
        } catch (error) {
          console.error('Error al recuperar sesión:', error);
        }
      }
    };
    
    recoverSession();
  }, [currentUser, setCurrentUser, routerPath]);
  
  return null; // No renderiza nada
};

function Router() {
  const uiRoot = withUiBase("/");
  const uiRootNoSlash = UI_BASE_PATH ? UI_BASE_PATH : "";
  const campaignRoot = withUiBase("/:campaignSlug");

  return (
    <>
      <SessionRecovery />
      <Switch>
        <Route path={uiRoot} component={ProtectedLoginRoute} />
        {uiRootNoSlash && (
          <Route path={uiRootNoSlash} component={ProtectedLoginRoute} />
        )}
        <Route path={withUiBase("/admin-login")} component={AdminLoginPage} />
        <Route path={withUiBase("/admin")}>
          <AdminProtectedRoute component={AdminPage} />
        </Route>

        <Route path={campaignRoot} component={ProtectedLoginRoute} />
        <Route path={withUiBase("/:campaignSlug/auth")} component={ProtectedLoginRoute} />
        <Route path={withUiBase("/:campaignSlug/register")} component={RegistrationPage} />
        <Route path={withUiBase("/:campaignSlug/map")} component={MapPage} />
        <Route path={withUiBase("/:campaignSlug/unlock")} component={QRUnlockHandler} />
        <Route path={withUiBase("/:campaignSlug/ranking")} component={RankingPage} />
        <Route path={withUiBase("/:campaignSlug/admin-login")}>
          <Redirect to={withUiBase("/admin-login")} />
        </Route>
        <Route path={withUiBase("/:campaignSlug/admin")}>
          {(params: { campaignSlug: string }) => (
            <LegacyAdminTenantRedirect campaignSlug={params.campaignSlug} />
          )}
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
