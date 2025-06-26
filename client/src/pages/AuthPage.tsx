import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/api";
import { useUser } from "@/context/UserContext";
import BrainLoader from "@/components/BrainLoader";

// Nombre de la clave para almacenar el último documento utilizado
const LAST_USER_KEY = "last_login_document";

const AuthPage = () => {
  const [documentNumber, setDocumentNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLastUser, setIsLoadingLastUser] = useState(true);
  const [lastDocument, setLastDocument] = useState<string | null>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser } = useUser();

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
            
            // Verificar si hay un redirect pendiente
            const urlParams = new URLSearchParams(window.location.search);
            const redirectUrl = urlParams.get('redirect');
            if (redirectUrl) {
              setLocation(decodeURIComponent(redirectUrl));
            } else {
              setLocation("/map");
            }
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
      <div className="flex flex-col items-center justify-center min-h-screen p-4" 
        style={{
          background: "url('https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png') repeat, linear-gradient(175deg, #bb2558 0%, #bb2558 75%, #e8cf00 100%)"
        }}>
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
            <BrainLoader size="large" text="Iniciando sesión automáticamente..." />
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Mostrar interfaz normal de login
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white" 
      style={{
        background: "url('https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png') repeat, linear-gradient(175deg, #bb2558 0%, #bb2558 75%, #e8cf00 100%)"
      }}>
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl border-0">
        <CardContent className="pt-8 pb-8 px-6">
          <div className="flex flex-col items-center justify-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Lanzamiento</h1>
            
            {/* Imagen de luz */}
            <div className="relative my-3">
              <img 
                src="https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png" 
                alt="Luz" 
                className="w-24 h-24 object-contain animate-pulse"
              />
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3/4 h-1 bg-yellow-300/20 rounded-full blur-md"></div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Smartfilms 2025</h2>
            <p className="text-gray-600 text-center max-w-xs">
              {lastDocument 
                ? "Continuar con tu cuenta o cambiar de usuario" 
                : "Ingresa con tu número de documento para acceder a tu mapa personal"
              }
            </p>
          </div>
          
          {lastDocument ? (
            <div className="space-y-5 mb-4">
              <div className="bg-gray-50/80 p-5 rounded-lg border border-gray-100 text-center shadow-sm">
                <div className="text-sm text-gray-500 mb-1">Documento guardado</div>
                <div className="text-xl font-medium text-gray-800">{lastDocument}</div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <Button 
                  onClick={() => {
                    setDocumentNumber(lastDocument);
                    handleSubmit(new Event('submit') as unknown as React.FormEvent);
                  }}
                  className="w-full py-6 text-base"
                  disabled={isLoading}
                >
                  Continuar
                  {isLoading && <BrainLoader size="small" className="ml-2" />}
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={handleChangeUser}
                  className="w-full py-6 text-base"
                >
                  Cambiar Usuario
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-3">
                <label htmlFor="document-number" className="block text-base font-medium text-gray-700">
                  Número de Documento
                </label>
                <Input
                  id="document-number"
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ingresa tu cédula"
                  className="w-full py-6 text-lg bg-white/80"
                  required
                />
              </div>
              
              <Button 
                type="submit"
                className="w-full flex items-center justify-center py-6 text-base mt-8"
                disabled={isLoading}
              >
                <span>{isLoading ? "Iniciando sesión..." : "Ingresar al Mapa"}</span>
                {isLoading ? (
                  <BrainLoader size="small" className="ml-2" />
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
