# Lista Completa de Dependencias - QR Code Quest

## Dependencias del Sistema (Debian/Ubuntu)

### Herramientas Base
```bash
curl                    # Cliente HTTP para descargas
wget                    # Descarga de archivos
git                     # Control de versiones
build-essential         # Compiladores C/C++
software-properties-common # Gestión de repositorios
```

### Node.js y NPM
```bash
nodejs (v20.x)          # Runtime JavaScript
npm (v10.x)             # Gestor de paquetes Node.js
```

### Base de Datos
```bash
postgresql-16           # Motor de base de datos
postgresql-client-16    # Cliente PostgreSQL
postgresql-contrib-16   # Extensiones PostgreSQL
```

### Servidor Web y Proxy
```bash
nginx                   # Servidor web/proxy reverso
```

### Gestión de Procesos
```bash
pm2                     # Gestor de procesos Node.js (instalado vía npm)
```

### Seguridad y SSL
```bash
certbot                 # Certificados SSL Let's Encrypt
python3-certbot-nginx   # Plugin Nginx para Certbot
ufw                     # Firewall simplificado
fail2ban                # Protección contra ataques de fuerza bruta
```

### Monitoreo
```bash
htop                    # Monitor de procesos
```

## Dependencias de Producción (package.json)

### Framework Backend
- `express`: ^4.21.2 - Servidor web Node.js
- `express-session`: ^1.18.1 - Gestión de sesiones

### Base de Datos y ORM
- `@neondatabase/serverless`: ^0.10.4 - Cliente Neon PostgreSQL
- `drizzle-orm`: ^0.39.1 - ORM TypeScript
- `drizzle-zod`: ^0.7.0 - Validación con Zod
- `connect-pg-simple`: ^10.0.0 - Almacén de sesiones PostgreSQL

### Frontend Framework
- `react`: ^18.3.1 - Biblioteca UI
- `react-dom`: ^18.3.1 - Renderizado DOM
- `wouter`: ^3.3.5 - Router ligero

### UI Components (Radix UI)
- `@radix-ui/react-dialog`: ^1.1.2 - Modales y diálogos
- `@radix-ui/react-tabs`: ^1.1.1 - Componente de pestañas
- `@radix-ui/react-button`: - Botones accesibles
- `@radix-ui/react-form`: - Formularios accesibles
- `@radix-ui/react-toast`: ^1.2.2 - Notificaciones
- Y 20+ componentes Radix UI adicionales

### Styling
- `tailwindcss`: - Framework CSS utilitario
- `tailwindcss-animate`: ^1.0.7 - Animaciones CSS
- `tailwind-merge`: ^2.5.4 - Merge de clases
- `class-variance-authority`: ^0.7.0 - Variantes de componentes
- `clsx`: ^2.1.1 - Utilidad de clases CSS

### QR Code Functionality
- `jsqr`: ^1.4.0 - Decodificación QR (frontend)
- `qrcode`: ^1.5.4 - Generación QR (backend)
- `html5-qrcode`: ^2.3.8 - Scanner QR HTML5

### Estado y Queries
- `@tanstack/react-query`: ^5.60.5 - Gestión de estado servidor

### Formularios
- `react-hook-form`: ^7.53.1 - Gestión de formularios
- `@hookform/resolvers`: ^3.9.1 - Resolvers para validación

### Validación
- `zod`: ^3.23.8 - Validación de esquemas
- `zod-validation-error`: ^3.4.0 - Errores de validación

### UI Avanzados
- `react-quill`: ^2.0.0 - Editor de texto enriquecido
- `react-day-picker`: ^8.10.1 - Selector de fechas
- `input-otp`: ^1.2.4 - Entrada de códigos OTP
- `cmdk`: ^1.0.0 - Paleta de comandos

### Animaciones
- `framer-motion`: ^11.13.1 - Animaciones React

### Gráficos y Charts
- `recharts`: ^2.13.0 - Gráficos React

### PDF Generation
- `jspdf`: ^3.0.1 - Generación de PDFs
- `jspdf-autotable`: ^5.0.2 - Tablas en PDF

### Utilities
- `date-fns`: ^3.6.0 - Manipulación de fechas
- `nanoid`: ^5.1.5 - Generador de IDs únicos
- `node-fetch`: ^3.3.2 - Cliente HTTP
- `lucide-react`: ^0.453.0 - Iconos
- `react-icons`: ^5.4.0 - Más iconos

### WebSocket
- `ws`: ^8.18.0 - WebSocket server

### Session Storage
- `memorystore`: ^1.6.7 - Almacén de sesiones en memoria

### Authentication
- `passport`: ^0.7.0 - Middleware de autenticación
- `passport-local`: ^1.0.0 - Estrategia local

### Carousels y Layouts
- `embla-carousel-react`: ^8.3.0 - Carrusel
- `react-resizable-panels`: ^2.1.4 - Paneles redimensionables
- `vaul`: ^1.1.0 - Drawer component

## Dependencias de Desarrollo

### TypeScript
- `typescript`: 5.6.3 - Lenguaje tipado
- `tsx`: ^4.19.1 - Ejecutor TypeScript
- `@types/node`: 20.16.11 - Tipos Node.js
- `@types/react`: ^18.3.11 - Tipos React
- `@types/react-dom`: ^18.3.1 - Tipos React DOM
- `@types/express`: 4.17.21 - Tipos Express
- `@types/express-session`: ^1.18.0 - Tipos sesiones
- `@types/passport`: ^1.0.16 - Tipos Passport
- `@types/passport-local`: ^1.0.38 - Tipos Passport Local
- `@types/ws`: ^8.5.13 - Tipos WebSocket
- `@types/qrcode`: ^1.5.5 - Tipos QR Code
- `@types/connect-pg-simple`: ^7.0.3 - Tipos session store

### Build Tools
- `vite`: ^5.4.14 - Build tool y dev server
- `@vitejs/plugin-react`: ^4.3.2 - Plugin React para Vite
- `esbuild`: ^0.25.0 - Bundler JavaScript

### Database Tools
- `drizzle-kit`: ^0.30.4 - CLI para migraciones

### CSS Tools
- `postcss`: ^8.4.47 - Procesador CSS
- `autoprefixer`: ^10.4.20 - Prefijos CSS automáticos
- `@tailwindcss/typography`: ^0.5.15 - Plugin tipografía

### Replit Specific
- `@replit/vite-plugin-cartographer`: ^0.2.7 - Herramientas desarrollo
- `@replit/vite-plugin-runtime-error-modal`: ^0.0.3 - Modal errores
- `@replit/vite-plugin-shadcn-theme-json`: ^0.0.4 - Configuración temas

### Source Maps
- `@jridgewell/trace-mapping`: ^0.3.25 - Mapeo de código fuente

## Dependencias Opcionales

### Performance
- `bufferutil`: ^4.0.8 - Optimización WebSocket

## Variables de Entorno Requeridas

### Desarrollo
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/database
NODE_ENV=development
PORT=5000
```

### Producción
```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/database
NODE_ENV=production
PORT=5000
SESSION_SECRET=clave_secreta_muy_larga_y_segura
ADMIN_PASSWORD=password_admin_opcional
```

## Puertos Utilizados

- **5000**: Aplicación Node.js/Express
- **80**: Nginx HTTP
- **443**: Nginx HTTPS (con SSL)
- **5432**: PostgreSQL
- **22**: SSH (administración)

## Requisitos de Sistema

### Mínimos
- **CPU**: 1 core
- **RAM**: 2GB
- **Almacenamiento**: 10GB
- **OS**: Debian 10+ / Ubuntu 18.04+

### Recomendados
- **CPU**: 2 cores
- **RAM**: 4GB
- **Almacenamiento**: 20GB SSD
- **OS**: Debian 11+ / Ubuntu 20.04+

### Para Alta Carga
- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Almacenamiento**: 50GB+ SSD
- **Balanceador de carga**: Nginx Load Balancer
- **Base de datos**: PostgreSQL con réplicas

## Comandos de Verificación

### Verificar Node.js
```bash
node --version  # v20.x.x
npm --version   # v10.x.x
```

### Verificar PostgreSQL
```bash
sudo systemctl status postgresql
psql --version  # PostgreSQL 16.x
```

### Verificar Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
```

### Verificar PM2
```bash
pm2 --version
pm2 status
```

### Verificar aplicación
```bash
curl -I http://localhost:5000
curl -I http://localhost  # A través de Nginx
```

## Troubleshooting Común

### Error: Cannot find module
```bash
npm install  # Reinstalar dependencias
```

### Error: Database connection
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### Error: Permission denied
```bash
sudo chown -R qrcodequest:qrcodequest /var/www/qrcodequest
```

### Error: Port already in use
```bash
sudo lsof -i :5000
sudo killall node  # Si es necesario
```

Esta lista cubre todas las dependencias necesarias para un despliegue completo y exitoso de la aplicación QR Code Quest en un servidor Debian.