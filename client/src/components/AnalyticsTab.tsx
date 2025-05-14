import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BrainLoader from './BrainLoader';
import { AlertTriangle, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Componente para mostrar estadísticas internas de usuarios
const UsersInternalStats = () => {
  const [usersData, setUsersData] = useState<{users: any[]} | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/admin/users-progress');
        if (!response.ok) {
          throw new Error('Error fetching user progress data');
        }
        const data = await response.json();
        setUsersData(data);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  if (isLoading) return <span className="text-gray-400">Cargando...</span>;
  if (!usersData) return <span className="text-red-500">Error</span>;
  
  return <>{usersData.users.length || 0}</>;
};

// Componente para mostrar estadísticas de progreso del mapa
const MapProgressStats = () => {
  const [usersData, setUsersData] = useState<{users: any[]} | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/admin/users-progress');
        if (!response.ok) {
          throw new Error('Error fetching user progress data');
        }
        const data = await response.json();
        setUsersData(data);
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  if (isLoading) return <div className="flex justify-center items-center h-full"><BrainLoader text="Cargando datos..." /></div>;
  if (!usersData) return <div className="text-red-500">Error al cargar datos</div>;
  
  // Procesamos los datos para el gráfico
  const users = usersData.users || [];
  
  // Agrupamos usuarios por porcentaje de completitud
  const completionGroups = {
    'No iniciado (0%)': 0,
    'Inicial (1-25%)': 0,
    'Medio (26-50%)': 0, 
    'Avanzado (51-75%)': 0,
    'Casi completo (76-99%)': 0,
    'Completo (100%)': 0
  };
  
  users.forEach(user => {
    const percentage = user.completionPercentage || 0;
    
    if (percentage === 0) completionGroups['No iniciado (0%)']++;
    else if (percentage <= 25) completionGroups['Inicial (1-25%)']++;
    else if (percentage <= 50) completionGroups['Medio (26-50%)']++;
    else if (percentage <= 75) completionGroups['Avanzado (51-75%)']++;
    else if (percentage < 100) completionGroups['Casi completo (76-99%)']++;
    else completionGroups['Completo (100%)']++;
  });
  
  const chartData = Object.entries(completionGroups).map(([name, value]) => ({
    name,
    value
  }));
  
  const PROGRESS_COLORS = ['#CCCCCC', '#FFE58F', '#FFD666', '#FFC53D', '#FAAD14', '#52C41A'];
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={70}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={PROGRESS_COLORS[index % PROGRESS_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} usuarios`, 'Cantidad']} />
      </PieChart>
    </ResponsiveContainer>
  );
};

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
  
  // Si hay error en la API de Replit Analytics, mostramos estadísticas internas
  // Esta es una mejor alternativa que solo mostrar un mensaje de error
  // Crear un componente interno para el panel alternativo
  const AlternativeAnalyticsPanel = () => {
    // Si no hay error, no mostramos este panel
    if (!error) return null;
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Estadísticas de la aplicación</h2>
          
          <div className="bg-amber-100 px-3 py-1 rounded-md text-amber-800 text-sm flex items-center">
            <AlertTriangle className="h-4 w-4 mr-1" />
            API externa no disponible - Mostrando datos internos
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Usuarios registrados</CardTitle>
              <CardDescription className="text-white/80">
                Personas que han creado una cuenta en la aplicación
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <div className="text-5xl font-bold mb-2 text-primary">
                  <UsersInternalStats />
                </div>
                <p className="text-gray-500 text-sm">Total de usuarios registrados</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="overflow-hidden">
            <CardHeader className="bg-primary text-white">
              <CardTitle className="text-xl">Progreso de Usuarios</CardTitle>
              <CardDescription className="text-white/80">
                Distribución del avance en el mapa
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="w-full h-[180px]">
                <MapProgressStats />
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="mt-8 px-4 py-3 bg-blue-50 rounded-md text-blue-800 text-sm">
          <details>
            <summary className="font-medium cursor-pointer">¿Por qué no puedo ver todas las analíticas?</summary>
            <div className="mt-2 pl-4 text-blue-700 space-y-2">
              <p>La API de Analytics de Replit no está disponible actualmente. Error: {error}</p>
              <p>Puedes intentar seguir estos pasos para habilitar las analíticas avanzadas:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Ve a la pestaña "Secrets" en tu Repl</li>
                <li>Añade un token de Replit como <code className="bg-blue-100 px-1 rounded">REPLIT_ANALYTICS_TOKEN</code></li>
                <li>Considera usar una solución alternativa como Google Analytics para estadísticas más detalladas</li>
              </ol>
            </div>
          </details>
        </div>
      </div>
    );
  };
  
  // Si hay error, mostrar panel alternativo
  if (error) {
    return <AlternativeAnalyticsPanel />;
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