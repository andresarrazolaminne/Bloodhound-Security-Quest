import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/api";
import { useUser } from "@/context/UserContext";
import { Loader2 } from "lucide-react";

// Nombre de la clave para almacenar el último documento utilizado
const LAST_USER_KEY = "last_login_document";

const AuthPage = () => {
  const [documentNumber, setDocumentNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLastUser, setIsLoadingLastUser] = useState(true);
  const [lastDocument, setLastDocument] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser, currentUser } = useUser();

  // Cargar el último usuario que se logueó
  useEffect(() => {
    try {
      const savedDocument = localStorage.getItem(LAST_USER_KEY);
      if (savedDocument) {
        setLastDocument(savedDocument);
        
        // Intentar autologin automático si hay un documento guardado
        const autoLogin = async () => {
          try {
            const response = await login(savedDocument);
            setCurrentUser(response.user);
            setLocation("/map");
          } catch (error) {
            console.log("No se pudo hacer auto-login con el documento guardado");
            setDocumentNumber(savedDocument || "");
          } finally {
            setIsLoadingLastUser(false);
          }
        };
        
        autoLogin();
      } else {
        setIsLoadingLastUser(false);
      }
    } catch (e) {
      setIsLoadingLastUser(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!documentNumber.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa tu número de documento",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const response = await login(documentNumber);
      
      // Guardar el documento para futuros logins
      localStorage.setItem(LAST_USER_KEY, documentNumber);
      setLastDocument(documentNumber);
      
      setCurrentUser(response.user);
      setLocation("/map");
      
    } catch (error) {
      // If user doesn't exist, redirect to registration
      if ((error as Response)?.status === 404) {
        setLocation(`/register?documentNumber=${documentNumber}`);
      } else {
        toast({
          title: "Error",
          description: "No pudimos iniciar sesión. Inténtalo de nuevo.",
          variant: "destructive"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para limpiar el último usuario y mostrar el formulario normal
  const handleChangeUser = () => {
    setLastDocument(null);
    setDocumentNumber("");
    localStorage.removeItem(LAST_USER_KEY);
  };

  // Mostrar pantalla de carga mientras verificamos si hay un usuario guardado
  if (isLoadingLastUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-primary to-primary/80 text-white">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-gray-700">Iniciando sesión automáticamente...</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Mostrar interfaz normal de login
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-primary to-primary/80 text-white">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-primary mb-2">Mapa de Logros</h1>
            <p className="text-gray-600">
              {lastDocument ? "Continuar con tu cuenta o cambiar de usuario" : "Ingresa con tu número de documento"}
            </p>
          </div>
          
          {lastDocument ? (
            <div className="space-y-4 mb-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-center">
                <div className="text-sm text-gray-500 mb-1">Guardado previamente</div>
                <div className="text-lg font-medium text-gray-800">{lastDocument}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => {
                    setDocumentNumber(lastDocument);
                    handleSubmit(new Event('submit') as unknown as React.FormEvent);
                  }}
                  className="w-full"
                  disabled={isLoading}
                >
                  Continuar
                  {isLoading && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleChangeUser}
                  className="w-full"
                >
                  Cambiar Usuario
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="document-number" className="block text-sm font-medium text-gray-700">
                  Número de Documento
                </label>
                <Input
                  id="document-number"
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ingresa tu cédula"
                  className="w-full"
                  required
                />
              </div>
              
              <Button 
                type="submit"
                className="w-full flex items-center justify-center"
                disabled={isLoading}
              >
                <span>Continuar</span>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 ml-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
