import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { login } from "@/lib/api";
import { useUser } from "@/context/UserContext";

const AuthPage = () => {
  const [documentNumber, setDocumentNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { setCurrentUser } = useUser();

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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-primary to-primary/80 text-white">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-primary mb-2">Mapa de Logros</h1>
            <p className="text-gray-600">Ingresa con tu número de documento</p>
          </div>
          
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
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthPage;
