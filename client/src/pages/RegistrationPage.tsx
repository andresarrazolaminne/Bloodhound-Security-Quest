import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { register } from "@/lib/api";
import { useUser } from "@/context/UserContext";
import BrainLoader from "@/components/BrainLoader";

const RegistrationPage = () => {
  const [name, setName] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser } = useUser();

  // Extract document number from URL query parameters
  useEffect(() => {
    const params = new URLSearchParams(location.split("?")[1]);
    const docNumber = params.get("documentNumber");
    if (docNumber) {
      setDocumentNumber(docNumber);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !documentNumber.trim()) {
      toast({
        title: "Error",
        description: "Por favor completa todos los campos",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      console.log("Enviando datos:", { documentNumber, name });
      const response = await register(documentNumber, name);

      setCurrentUser(response.user);
      setLocation("/map");

      toast({
        title: "Bienvenido",
        description: "Tu cuenta ha sido creada exitosamente",
      });
    } catch (error: any) {
      console.error("Error en registro:", error);

      // Intentar extraer el mensaje de error detallado
      let errorMessage = "No pudimos registrar tu cuenta. Inténtalo de nuevo.";

      if (error?.json) {
        try {
          const errorData = await error.json();
          if (errorData?.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Si no podemos parsear el error, usamos el mensaje genérico
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-white"
      style={{
        background: "url('https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Textura-fondo-pagina.png') repeat, linear-gradient(175deg, #bb2558 0%, #bb2558 75%, #e8cf00 100%)"
      }}>
      <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl border-0">
        <CardContent className="pt-8 pb-8 px-6">
          <div className="flex flex-col items-center justify-center mb-8">
            {/* Imagen de luz */}
            <div className="relative mb-4">
              <img 
                src="https://deuouqyoujoig.cloudfront.net/uploads/2025/grafica/Luz.png" 
                alt="Luz" 
                className="w-24 h-24 object-contain animate-pulse"
              />
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-3/4 h-1 bg-yellow-300/20 rounded-full blur-md"></div>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 mb-2 text-center">Bienvenido</h1>
            <p className="text-gray-600 text-center max-w-xs">
              Es tu primera vez, por favor completa tus datos para acceder al mapa
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="hidden" name="documentNumber" value={documentNumber} />

            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="document-number" className="block text-base font-medium text-gray-700">
                  Número de Documento
                </label>
                <Input
                  id="document-number"
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ingresa tu número de cédula"
                  className="w-full py-6 text-lg bg-white/80"
                  required
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="user-name" className="block text-base font-medium text-gray-700">
                  Nombre Completo
                </label>
                <Input
                  id="user-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ingresa tu nombre completo"
                  className="w-full py-6 text-lg bg-white/80"
                  required
                />
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <Button 
                type="submit"
                className="w-full flex items-center justify-center py-6 text-base"
                disabled={isLoading}
              >
                <span>{isLoading ? "Registrando..." : "Crear mi cuenta"}</span>
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                )}
              </Button>
              <Button 
                type="button"
                variant="outline"
                className="w-full py-6 text-base"
                onClick={() => setLocation("/")}
              >
                Volver al inicio
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistrationPage;