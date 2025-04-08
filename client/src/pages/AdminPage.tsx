import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { redeemPrize } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const AdminPage = () => {
  const [redemptionCode, setRedemptionCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    redeemedAt?: string;
  } | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!redemptionCode.trim()) {
      toast({
        title: "Error",
        description: "Por favor ingresa un código de redención",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      setResult(null);
      
      const response = await redeemPrize(redemptionCode);
      
      setResult({
        success: true,
        message: "Premio disponible para redención"
      });
      
      toast({
        title: "Éxito",
        description: "Premio validado correctamente",
      });
      
    } catch (error) {
      const errorResponse = await (error as Response).json();
      
      if (errorResponse.redeemedAt) {
        // Already redeemed
        setResult({
          success: false,
          message: "Premio ya reclamado",
          redeemedAt: errorResponse.redeemedAt
        });
      } else {
        // Invalid code or other error
        setResult({
          success: false,
          message: errorResponse.message || "Código de redención inválido"
        });
      }
      
      toast({
        title: "Error",
        description: errorResponse.message || "Código de redención inválido",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="bg-primary text-white">
          <CardTitle className="text-xl">Validación de Premios</CardTitle>
        </CardHeader>
        
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="redemption-code" className="block text-sm font-medium text-gray-700">
                Código de Redención
              </label>
              <Input
                id="redemption-code"
                type="text"
                value={redemptionCode}
                onChange={(e) => setRedemptionCode(e.target.value)}
                placeholder="Ingresa el código de redención"
                className="w-full"
                required
              />
            </div>
            
            <Button 
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Validando..." : "Validar Premio"}
            </Button>
          </form>
          
          {result && (
            <div className={`mt-6 p-4 rounded-md ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className="flex items-center mb-2">
                <Badge variant={result.success ? "success" : "destructive"} className="mr-2">
                  {result.success ? "Válido" : "Inválido"}
                </Badge>
                <p className="font-medium">{result.message}</p>
              </div>
              
              {result.redeemedAt && (
                <p className="text-sm text-gray-600">
                  Reclamado el: {new Date(result.redeemedAt).toLocaleString()}
                </p>
              )}
              
              {result.success && (
                <div className="flex justify-end mt-4">
                  <Button 
                    variant="default" 
                    onClick={() => {
                      toast({
                        title: "Premio entregado",
                        description: "El premio ha sido marcado como entregado",
                      });
                      setResult(null);
                      setRedemptionCode("");
                    }}
                  >
                    Confirmar Entrega
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;
