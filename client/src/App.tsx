import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from "@/context/UserContext";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/AuthPage";
import MapPage from "@/pages/MapPage";
import RegistrationPage from "@/pages/RegistrationPage";
import AdminPage from "@/pages/AdminPage";
import QRGeneratorPage from "@/pages/QRGeneratorPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={AuthPage} />
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
