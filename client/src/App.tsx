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
import QRGeneratorPage from "@/pages/QRGeneratorPage";
import { Loader2 } from "lucide-react";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={ProtectedLoginRoute} />
      <Route path="/register" component={RegistrationPage} />
      <Route path="/map" component={MapPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/qr-generator" component={QRGeneratorPage} />
      <Route component={NotFound} />
    </Switch>
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
