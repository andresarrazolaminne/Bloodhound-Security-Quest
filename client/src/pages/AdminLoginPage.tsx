import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { withUiBase } from "@/lib/paths";

// Este código se guardará de forma segura en el backend posteriormente
const ADMIN_ACCESS_CODE = "admin123";

const AdminLoginPage = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [accessCode, setAccessCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa el código de acceso",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Simulamos un pequeño retraso para la autenticación
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (accessCode === ADMIN_ACCESS_CODE) {
        // Guardar el estado de autenticación en sessionStorage
        sessionStorage.setItem("adminAuthenticated", "true");
        
        toast({
          title: "Acceso correcto",
          description: "Bienvenido al panel de administración",
        });
        
        // Redirigir al panel de administración
        setLocation(withUiBase("/admin"));
      } else {
        toast({
          title: "Código incorrecto",
          description: "El código de acceso es inválido",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error al intentar acceder",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-primary text-white">
          <CardTitle className="text-xl">Panel de Administración</CardTitle>
          <CardDescription className="text-gray-100">
            Ingresa el código de acceso para continuar
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleLogin}>
          <CardContent className="pt-6">
            <div className="mb-4">
              <label htmlFor="accessCode" className="block text-sm font-medium text-gray-700 mb-1">
                Código de Acceso
              </label>
              <Input
                id="accessCode"
                type="password"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                placeholder="Ingresa el código de acceso"
                autoFocus
                autoComplete="off"
              />
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                  Verificando...
                </>
              ) : (
                "Acceder"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AdminLoginPage;