import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BrainLoader from './BrainLoader';
import { AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Colores para gráficos
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#BB2558', '#E8CF00'];

interface ReplitAnalyticsData {
  // Métricas básicas
  totalVisits: number;
  totalUsers: number;
  newUsers: number;
  returningUsers: number;
  
  // Datos por período
  visitsByDay: {
    date: string;
    visits: number;
    uniqueUsers: number;
  }[];
  
  // Datos de dispositivos
  deviceData: {
    name: string;
    value: number;
  }[];
  
  // Datos de navegadores
  browserData: {
    name: string;
    value: number;
  }[];
  
  // Datos de países
  countryData: {
    name: string;
    value: number;
  }[];
  
  // Campo opcional para mensajes de error
  // (No es parte de la respuesta normal de la API, solo se usa cuando hay errores)
  _error?: string;
}

const AnalyticsTab: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<ReplitAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  
  useEffect(() => {
    const fetchAnalyticsData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/admin/analytics?timeRange=${timeRange}`);
        
        if (!response.ok) {
          throw new Error('Error al obtener datos de analíticas');
        }
        
        const data = await response.json();
        
        // Verificamos si la respuesta contiene un mensaje de error
        if (data._error) {
          setError(data._error);
          setAnalyticsData(data); // Aún así guardamos los datos vacíos para evitar errores
        } else {
          setAnalyticsData(data);
        }
      } catch (err) {
        setError('No se pudieron cargar los datos de analíticas');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAnalyticsData();
  }, [timeRange]);
  
  // Si está cargando, mostrar indicador
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <BrainLoader size="large" text="Cargando datos de analíticas..." />
      </div>
    );
  }
  
  // Si hay error, mostrar mensaje
  if (error) {
    return (
      <div className="bg-red-50 p-6 rounded-md border border-red-200 text-center">
        <div className="flex justify-center mb-4">
          <AlertTriangle className="h-10 w-10 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-red-800 mb-2">No se pudieron cargar las analíticas</h3>
        <p className="text-red-600 mb-4">{error}</p>
        <div className="bg-white p-4 rounded border border-red-100 text-left mb-4">
          <p className="text-gray-700 font-medium mb-2">Posibles causas:</p>
          <ul className="list-disc pl-5 space-y-1 text-gray-600">
            <li>El token de Replit Analytics no tiene los permisos necesarios</li>
            <li>La API de Replit Analytics ha cambiado o requiere configuración adicional</li>
            <li>El Repl ID no está configurado correctamente</li>
          </ul>
        </div>
        
        <div className="bg-blue-50 p-4 rounded border border-blue-100 text-left mb-4">
          <p className="text-blue-800 font-medium mb-2">Pasos para configurar Replit Analytics:</p>
          <ol className="list-decimal pl-5 space-y-1 text-blue-700">
            <li>Inicia sesión en tu cuenta de Replit</li>
            <li>Ve a Configuración &gt; API Keys (desde el menú de tu cuenta)</li>
            <li>Crea un nuevo token con permisos de <code className="bg-blue-100 px-1 rounded">read:repls</code> y <code className="bg-blue-100 px-1 rounded">read:analytics</code></li>
            <li>Configura el token como secreto en el Repl con el nombre <code className="bg-blue-100 px-1 rounded">REPLIT_ANALYTICS_TOKEN</code></li>
          </ol>
        </div>
        
        <p className="text-gray-600 text-sm">
          Para resolver este problema, sigue los pasos indicados para generar y configurar un token de API con los permisos correctos.
        </p>
      </div>
    );
  }
  
  // Si no hay datos, mostrar estado vacío
  if (!analyticsData) {
    return (
      <div className="bg-gray-50 p-8 rounded-lg text-center border">
        <p className="text-gray-500 mb-2">No hay datos de analíticas disponibles</p>
        <p className="text-gray-400 text-sm">
          Esto podría deberse a que la aplicación aún no ha recopilado suficientes datos o a que
          el acceso a las analíticas requiere configuración.
        </p>
      </div>
    );
  }
  
  // Renderizar los datos de analíticas
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800">Analíticas de la Aplicación</h2>
        
        <div className="bg-gray-100 rounded-lg p-1">
          <button 
            className={`px-3 py-1 rounded-md ${timeRange === '7d' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setTimeRange('7d')}
          >
            7 días
          </button>
          <button 
            className={`px-3 py-1 rounded-md ${timeRange === '30d' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setTimeRange('30d')}
          >
            30 días
          </button>
          <button 
            className={`px-3 py-1 rounded-md ${timeRange === '90d' ? 'bg-white shadow' : 'text-gray-600'}`}
            onClick={() => setTimeRange('90d')}
          >
            90 días
          </button>
        </div>
      </div>
      
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          title="Visitas Totales" 
          value={analyticsData.totalVisits.toLocaleString()} 
          icon={<VisitsIcon />} 
        />
        <MetricCard 
          title="Usuarios Únicos" 
          value={analyticsData.totalUsers.toLocaleString()} 
          icon={<UsersIcon />} 
        />
        <MetricCard 
          title="Nuevos Usuarios" 
          value={analyticsData.newUsers.toLocaleString()} 
          icon={<NewUsersIcon />} 
        />
        <MetricCard 
          title="Usuarios Recurrentes" 
          value={analyticsData.returningUsers.toLocaleString()} 
          icon={<ReturningUsersIcon />} 
        />
      </div>
      
      {/* Gráficos */}
      <Tabs defaultValue="visits">
        <TabsList className="mb-4">
          <TabsTrigger value="visits">Tráfico</TabsTrigger>
          <TabsTrigger value="devices">Dispositivos</TabsTrigger>
          <TabsTrigger value="browsers">Navegadores</TabsTrigger>
          <TabsTrigger value="countries">Países</TabsTrigger>
        </TabsList>
        
        <TabsContent value="visits" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Visitas por Día</CardTitle>
              <CardDescription>
                Número de visitas y usuarios únicos por día
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData.visitsByDay}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="visits" fill="#BB2558" name="Visitas" />
                  <Bar dataKey="uniqueUsers" fill="#E8CF00" name="Usuarios Únicos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="devices" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Dispositivos</CardTitle>
              <CardDescription>
                Porcentaje de usuarios por tipo de dispositivo
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.deviceData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.deviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="browsers" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Navegadores</CardTitle>
              <CardDescription>
                Porcentaje de usuarios por navegador
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analyticsData.browserData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analyticsData.browserData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="countries" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Distribución por Países</CardTitle>
              <CardDescription>
                Usuarios por ubicación geográfica
              </CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={analyticsData.countryData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={100} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="value" fill="#BB2558" name="Usuarios" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Componentes auxiliares
const MetricCard = ({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
          {icon}
        </div>
      </div>
    </CardContent>
  </Card>
);

// Iconos para las tarjetas
const VisitsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const NewUsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" x2="19" y1="8" y2="14" />
    <line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

const ReturningUsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 2.1l4 4-4 4" />
    <path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4" />
    <path d="M21 11.8v2a4 4 0 0 1-4 4H4.2" />
  </svg>
);

export default AnalyticsTab;