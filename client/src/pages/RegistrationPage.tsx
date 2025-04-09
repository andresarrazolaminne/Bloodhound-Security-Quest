import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { register } from "@/lib/api";
import { useUser } from "@/context/UserContext";

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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-primary to-primary/80 text-white">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Bienvenido</h1>
            <p className="text-gray-600">Es tu primera vez, por favor ingresa tu nombre</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <input type="hidden" name="documentNumber" value={documentNumber} />

            <div className="space-y-2">
              <div className="mb-4">
                <label htmlFor="document-number" className="block text-sm font-medium text-gray-700">
                  Número de Documento
                </label>
                <Input
                  id="document-number"
                  type="text"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="Ingresa tu número de cédula"
                  className="w-full"
                  required
                  readOnly={documentNumber !== ""}
                />
              </div>

              <label htmlFor="user-name" className="block text-sm font-medium text-gray-700">
                Nombre Completo
              </label>
              <Input
                id="user-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ingresa tu nombre completo"
                className="w-full"
                required
              />
            </div>

            <div className="space-y-3">
              <Button 
                type="submit"
                className="w-full flex items-center justify-center bg-orange-500 hover:bg-orange-600"
                disabled={isLoading}
              >
                <span>Registrarme</span>
                {!isLoading && (
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
                className="w-full"
                onClick={() => setLocation("/")}
              >
                Atrás
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegistrationPage;