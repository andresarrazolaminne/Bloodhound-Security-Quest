import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Medal, Award, MapPin, Users, Crown } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import BrainLoader from "@/components/BrainLoader";

interface RankingUser {
  user: {
    id: number;
    documentNumber: string;
    name: string;
    venueId: number;
    completedAt: string | null;
  };
  validQRsScanned: number;
  trapQRsScanned: number;
  totalScore: number;
  position: number;
}

interface Venue {
  id: number;
  name: string;
  location: string | null;
  isActive: boolean;
  maxParticipants: number | null;
}

interface SystemConfig {
  headerLogoImageUrl: string;
  headerLogoSize: number;
  headerBackgroundColor: string;
  headerTextColor: string;
  gradientStartColor: string;
  gradientEndColor: string;
  gradientMidColor: string;
  gradientDirection: string;
  appTitle: string;
}

const RankingPage = () => {
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    headerLogoImageUrl: "",
    headerLogoSize: 64,
    headerBackgroundColor: "#3b82f6",
    headerTextColor: "#ffffff",
    gradientStartColor: "#bb2558",
    gradientEndColor: "#e8cf00",
    gradientMidColor: "",
    gradientDirection: "175deg",
    appTitle: "QR Code Quest"
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRanking, setIsLoadingRanking] = useState(false);

  // Cargar configuración del sistema
  useEffect(() => {
    const fetchSystemConfig = async () => {
      try {
        const response = await apiRequest("GET", "/api/system-config");
        if (response.ok) {
          const data = await response.json();
          setSystemConfig(data.config);
        }
      } catch (error) {
        console.error("Error fetching system config:", error);
      }
    };
    fetchSystemConfig();
  }, []);

  // Cargar venues
  useEffect(() => {
    const fetchVenues = async () => {
      try {
        const response = await apiRequest("GET", "/api/venues/active");
        if (response.ok) {
          const data = await response.json();
          setVenues(data.venues);
          // Seleccionar la primera sede por defecto
          if (data.venues.length > 0) {
            setSelectedVenueId(data.venues[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching venues:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVenues();
  }, []);

  // Cargar ranking cuando cambia la sede seleccionada
  useEffect(() => {
    if (selectedVenueId) {
      fetchRanking(selectedVenueId);
    }
  }, [selectedVenueId]);

  const fetchRanking = async (venueId: number) => {
    try {
      setIsLoadingRanking(true);
      const response = await apiRequest("GET", `/api/venues/${venueId}/score-ranking`);
      if (response.ok) {
        const data = await response.json();
        setRanking(data.ranking);
      }
    } catch (error) {
      console.error("Error fetching ranking:", error);
    } finally {
      setIsLoadingRanking(false);
    }
  };

  const getRankIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <Trophy className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPositionColor = (position: number) => {
    switch (position) {
      case 1:
        return "bg-gradient-to-r from-yellow-400 to-yellow-600 text-white";
      case 2:
        return "bg-gradient-to-r from-gray-300 to-gray-500 text-white";
      case 3:
        return "bg-gradient-to-r from-amber-400 to-amber-600 text-white";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4"
           style={{
             background: systemConfig.gradientMidColor 
               ? `linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor}, ${systemConfig.gradientMidColor}, ${systemConfig.gradientEndColor})`
               : `linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor}, ${systemConfig.gradientEndColor})`
           }}>
        <Card className="w-full max-w-md bg-white/90 backdrop-blur-sm shadow-xl">
          <CardContent className="pt-6 flex flex-col items-center justify-center py-12">
            <BrainLoader size="large" text="Cargando ranking..." />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen"
         style={{
           background: systemConfig.gradientMidColor 
             ? `linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor}, ${systemConfig.gradientMidColor}, ${systemConfig.gradientEndColor})`
             : `linear-gradient(${systemConfig.gradientDirection}, ${systemConfig.gradientStartColor}, ${systemConfig.gradientEndColor})`
         }}>
      
      {/* Header */}
      <header 
        className="shadow-lg sticky top-0 z-50 backdrop-blur-sm"
        style={{ 
          backgroundColor: `${systemConfig.headerBackgroundColor}dd`,
          color: systemConfig.headerTextColor 
        }}
      >
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <img 
              src={systemConfig.headerLogoImageUrl} 
              alt="Logo" 
              className="object-contain"
              style={{ height: `${systemConfig.headerLogoSize}px` }}
            />
            <div>
              <h1 className="text-2xl font-bold">{systemConfig.appTitle}</h1>
              <p className="text-sm opacity-90">Ranking de Participantes</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        
        {/* Filtro de Sede */}
        <Card className="mb-8 bg-white/90 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Selecciona una Sede</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {venues.map((venue) => (
                <button
                  key={venue.id}
                  onClick={() => setSelectedVenueId(venue.id)}
                  className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                    selectedVenueId === venue.id
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {venue.name}
                  {venue.location && <span className="ml-1 text-xs opacity-75">({venue.location})</span>}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Información de la Sede Seleccionada */}
        {selectedVenue && (
          <Card className="mb-8 bg-white/90 backdrop-blur-sm shadow-lg">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">{selectedVenue.name}</h2>
                  {selectedVenue.location && (
                    <p className="text-gray-600 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {selectedVenue.location}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-1" />
                    <span className="text-sm">
                      {ranking.length} participantes
                      {selectedVenue.maxParticipants && ` / ${selectedVenue.maxParticipants} máx`}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ranking */}
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="w-5 h-5" />
              <span>Ranking de Participantes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingRanking ? (
              <div className="flex justify-center py-8">
                <BrainLoader size="medium" text="Cargando ranking..." />
              </div>
            ) : ranking.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Aún no hay participantes en esta sede</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ranking.map((participant, index) => (
                  <div 
                    key={participant.user.id} 
                    className={`p-4 rounded-lg border-2 transition-all duration-200 hover:shadow-md ${
                      participant.position <= 3 ? 'border-yellow-200 bg-yellow-50/50' : 'border-gray-200 bg-white/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {/* Posición */}
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${getPositionColor(participant.position)}`}>
                          {participant.position <= 3 ? (
                            getRankIcon(participant.position)
                          ) : (
                            <span className="font-bold text-lg">#{participant.position}</span>
                          )}
                        </div>
                        
                        {/* Información del Usuario */}
                        <div>
                          <h3 className="font-semibold text-gray-800">{participant.user.name}</h3>
                          <p className="text-sm text-gray-600">
                            QR Válidos: {participant.validQRsScanned} | QR Trampas: {participant.trapQRsScanned}
                          </p>
                          <div className="flex items-center space-x-2 text-xs text-gray-500">
                            <span>Puntaje Total: {participant.totalScore} puntos</span>
                            <span className="text-green-600">
                              (+{participant.validQRsScanned * 10} válidos)
                            </span>
                            {participant.trapQRsScanned > 0 && (
                              <span className="text-red-500">
                                (-{participant.trapQRsScanned * 5} trampas)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Puntaje */}
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-800">
                            {participant.totalScore}
                          </div>
                          <div className="text-sm text-gray-500">
                            puntos
                          </div>
                          {participant.totalScore > 0 && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                              Activo
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-center">
                          <div className="text-lg font-semibold text-green-600">
                            +{participant.validQRsScanned * 10}
                          </div>
                          <div className="text-xs text-gray-500">
                            Válidos
                          </div>
                        </div>
                        
                        <div className="text-center">
                          <div className="text-lg font-semibold text-red-600">
                            -{participant.trapQRsScanned * 5}
                          </div>
                          <div className="text-xs text-gray-500">
                            Trampas
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RankingPage;