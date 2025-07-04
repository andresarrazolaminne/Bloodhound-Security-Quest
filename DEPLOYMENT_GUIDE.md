# Guía de Despliegue - QR Code Quest Application
## Servidor Debian

Esta guía proporciona instrucciones detalladas para desplegar la aplicación QR Code Quest en un servidor Debian.

## Requisitos del Sistema

### Sistema Operativo
- Debian 11 (Bullseye) o superior
- Ubuntu 20.04 LTS o superior

### Hardware Mínimo Recomendado
- CPU: 2 cores
- RAM: 4GB
- Almacenamiento: 20GB SSD
- Conexión a Internet estable

## Instalación de Dependencias del Sistema

### 1. Actualizar el Sistema
```bash
sudo apt update && sudo apt upgrade -y
```

### 2. Instalar Herramientas Básicas
```bash
sudo apt install -y curl wget git build-essential software-properties-common
```

### 3. Instalar Node.js 20.x
```bash
# Agregar repositorio oficial de NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar instalación
node --version  # Debe mostrar v20.x.x
npm --version   # Debe mostrar v10.x.x o superior
```

### 4. Instalar PostgreSQL 16
```bash
# Agregar repositorio oficial de PostgreSQL
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

# Instalar PostgreSQL
sudo apt install -y postgresql-16 postgresql-client-16 postgresql-contrib-16

# Verificar instalación
sudo systemctl status postgresql
```

### 5. Instalar PM2 (Gestor de Procesos)
```bash
sudo npm install -g pm2
```

### 6. Instalar Nginx (Servidor Web/Proxy Reverso)
```bash
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 7. Instalar Certbot (SSL/TLS)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

## Configuración de PostgreSQL

### 1. Configurar Usuario y Base de Datos
```bash
# Cambiar a usuario postgres
sudo -u postgres psql

# Dentro de PostgreSQL:
CREATE USER qrcodequest WITH PASSWORD 'tu_password_seguro_aqui';
CREATE DATABASE qrcodequest OWNER qrcodequest;
GRANT ALL PRIVILEGES ON DATABASE qrcodequest TO qrcodequest;
\q
```

### 2. Configurar Acceso Remoto (si es necesario)
```bash
# Editar archivo de configuración
sudo nano /etc/postgresql/16/main/postgresql.conf

# Cambiar la línea:
listen_addresses = 'localhost'
# Por:
listen_addresses = '*'

# Editar archivo de autenticación
sudo nano /etc/postgresql/16/main/pg_hba.conf

# Agregar línea para permitir conexiones con contraseña:
host    all             all             0.0.0.0/0               md5

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
```

## Despliegue de la Aplicación

### 1. Crear Usuario del Sistema
```bash
sudo adduser --system --group --home /var/www/qrcodequest qrcodequest
sudo mkdir -p /var/www/qrcodequest
sudo chown qrcodequest:qrcodequest /var/www/qrcodequest
```

### 2. Clonar y Preparar la Aplicación
```bash
# Cambiar al directorio de la aplicación
cd /var/www/qrcodequest

# Si tienes el código en un repositorio Git:
sudo -u qrcodequest git clone https://github.com/tu-usuario/qr-code-quest.git .

# Si tienes el código en archivos locales, copiarlo:
# sudo cp -r /ruta/a/tu/codigo/* /var/www/qrcodequest/
# sudo chown -R qrcodequest:qrcodequest /var/www/qrcodequest/
```

### 3. Instalar Dependencias de Node.js
```bash
cd /var/www/qrcodequest
sudo -u qrcodequest npm install
```

### 4. Configurar Variables de Entorno
```bash
# Crear archivo de variables de entorno
sudo -u qrcodequest nano /var/www/qrcodequest/.env

# Contenido del archivo .env:
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://qrcodequest:tu_password_seguro_aqui@localhost:5432/qrcodequest

# Variables adicionales si son necesarias:
SESSION_SECRET=tu_session_secret_muy_largo_y_seguro_aqui
ADMIN_PASSWORD=tu_password_admin_seguro
```

### 5. Construir la Aplicación
```bash
cd /var/www/qrcodequest
sudo -u qrcodequest npm run build
```

### 6. Ejecutar Migraciones de Base de Datos
```bash
cd /var/www/qrcodequest
sudo -u qrcodequest npm run db:push
```

## Configuración de PM2

### 1. Crear Archivo de Configuración PM2
```bash
sudo -u qrcodequest nano /var/www/qrcodequest/ecosystem.config.js
```

Contenido del archivo:
```javascript
module.exports = {
  apps: [{
    name: 'qr-code-quest',
    script: 'dist/index.js',
    cwd: '/var/www/qrcodequest',
    user: 'qrcodequest',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    instances: 1,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/www/qrcodequest/logs/err.log',
    out_file: '/var/www/qrcodequest/logs/out.log',
    log_file: '/var/www/qrcodequest/logs/combined.log',
    time: true
  }]
};
```

### 2. Crear Directorio de Logs
```bash
sudo -u qrcodequest mkdir -p /var/www/qrcodequest/logs
```

### 3. Iniciar Aplicación con PM2
```bash
cd /var/www/qrcodequest
sudo -u qrcodequest pm2 start ecosystem.config.js
sudo -u qrcodequest pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u qrcodequest --hp /var/www/qrcodequest
```

## Configuración de Nginx

### 1. Crear Configuración del Sitio
```bash
sudo nano /etc/nginx/sites-available/qrcodequest
```

Contenido del archivo:
```nginx
server {
    listen 80;
    server_name tu-dominio.com www.tu-dominio.com;

    # Logs
    access_log /var/log/nginx/qrcodequest_access.log;
    error_log /var/log/nginx/qrcodequest_error.log;

    # Proxy hacia la aplicación Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }

    # Configuración para archivos estáticos
    location /static/ {
        alias /var/www/qrcodequest/dist/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Configuración de seguridad
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    # Limitar tamaño de archivos
    client_max_body_size 10M;
}
```

### 2. Habilitar el Sitio
```bash
sudo ln -s /etc/nginx/sites-available/qrcodequest /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Configuración SSL con Let's Encrypt

### 1. Obtener Certificado SSL
```bash
sudo certbot --nginx -d tu-dominio.com -d www.tu-dominio.com
```

### 2. Configurar Renovación Automática
```bash
sudo crontab -e

# Agregar línea para renovación automática:
0 12 * * * /usr/bin/certbot renew --quiet
```

## Configuración de Firewall

### 1. Configurar UFW
```bash
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw allow 5432  # PostgreSQL (solo si necesitas acceso externo)
sudo ufw enable
```

## Scripts de Mantenimiento

### 1. Script de Backup de Base de Datos
```bash
sudo nano /usr/local/bin/backup-qrcodequest.sh
```

Contenido:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/qrcodequest"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE="qrcodequest"
USER="qrcodequest"

# Crear directorio de backup si no existe
mkdir -p $BACKUP_DIR

# Realizar backup
pg_dump -h localhost -U $USER -d $DATABASE > $BACKUP_DIR/qrcodequest_$DATE.sql

# Mantener solo los últimos 7 backups
find $BACKUP_DIR -name "qrcodequest_*.sql" -mtime +7 -delete

echo "Backup completed: qrcodequest_$DATE.sql"
```

```bash
sudo chmod +x /usr/local/bin/backup-qrcodequest.sh

# Programar backup diario
sudo crontab -e
# Agregar:
0 2 * * * /usr/local/bin/backup-qrcodequest.sh
```

### 2. Script de Actualización
```bash
sudo nano /usr/local/bin/update-qrcodequest.sh
```

Contenido:
```bash
#!/bin/bash
APP_DIR="/var/www/qrcodequest"
USER="qrcodequest"

echo "Updating QR Code Quest application..."

# Cambiar al directorio de la aplicación
cd $APP_DIR

# Hacer backup de la base de datos
/usr/local/bin/backup-qrcodequest.sh

# Detener la aplicación
sudo -u $USER pm2 stop qr-code-quest

# Actualizar código (si usas Git)
sudo -u $USER git pull

# Instalar nuevas dependencias
sudo -u $USER npm install

# Construir aplicación
sudo -u $USER npm run build

# Ejecutar migraciones
sudo -u $USER npm run db:push

# Reiniciar aplicación
sudo -u $USER pm2 restart qr-code-quest

echo "Update completed successfully!"
```

```bash
sudo chmod +x /usr/local/bin/update-qrcodequest.sh
```

## Monitoreo y Logs

### 1. Verificar Estado de la Aplicación
```bash
# Estado de PM2
sudo -u qrcodequest pm2 status

# Logs de la aplicación
sudo -u qrcodequest pm2 logs qr-code-quest

# Logs de Nginx
sudo tail -f /var/log/nginx/qrcodequest_access.log
sudo tail -f /var/log/nginx/qrcodequest_error.log

# Estado de PostgreSQL
sudo systemctl status postgresql
```

### 2. Comandos de Mantenimiento
```bash
# Reiniciar aplicación
sudo -u qrcodequest pm2 restart qr-code-quest

# Reiniciar Nginx
sudo systemctl restart nginx

# Reiniciar PostgreSQL
sudo systemctl restart postgresql

# Ver uso de recursos
htop
df -h
free -h
```

## Solución de Problemas Comunes

### 1. Aplicación no Inicia
```bash
# Verificar logs
sudo -u qrcodequest pm2 logs qr-code-quest

# Verificar variables de entorno
sudo -u qrcodequest pm2 env 0

# Verificar conectividad a base de datos
sudo -u postgres psql -c "SELECT version();"
```

### 2. Error de Conexión a Base de Datos
```bash
# Verificar estado de PostgreSQL
sudo systemctl status postgresql

# Verificar conexión
sudo -u qrcodequest psql -h localhost -U qrcodequest -d qrcodequest -c "SELECT 1;"
```

### 3. Error 502 Bad Gateway
```bash
# Verificar si la aplicación está corriendo
sudo -u qrcodequest pm2 status

# Verificar configuración de Nginx
sudo nginx -t

# Verificar logs de Nginx
sudo tail -f /var/log/nginx/qrcodequest_error.log
```

## Configuración de Seguridad Adicional

### 1. Configurar Fail2Ban
```bash
sudo apt install -y fail2ban

# Configurar para SSH y Nginx
sudo nano /etc/fail2ban/jail.local
```

Contenido:
```ini
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Configurar Logrotate
```bash
sudo nano /etc/logrotate.d/qrcodequest
```

Contenido:
```
/var/www/qrcodequest/logs/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 qrcodequest qrcodequest
    postrotate
        sudo -u qrcodequest pm2 reloadLogs
    endscript
}
```

## Lista de Verificación Final

- [ ] Sistema actualizado y dependencias instaladas
- [ ] PostgreSQL configurado y funcionando
- [ ] Base de datos creada y migrada
- [ ] Aplicación construida y desplegada
- [ ] PM2 configurado y aplicación ejecutándose
- [ ] Nginx configurado y proxy funcionando
- [ ] SSL configurado (si aplicable)
- [ ] Firewall configurado
- [ ] Scripts de backup configurados
- [ ] Monitoreo funcionando
- [ ] Documentación de accesos guardada de forma segura

## Información de Contacto de Emergencia

- Usuario del sistema: `qrcodequest`
- Directorio de aplicación: `/var/www/qrcodequest`
- Puerto de aplicación: `5000`
- Base de datos: `qrcodequest` en PostgreSQL puerto `5432`
- Logs de aplicación: `/var/www/qrcodequest/logs/`
- Logs de Nginx: `/var/log/nginx/`

---

**Nota Importante**: Guarda de forma segura todas las contraseñas y claves de acceso. Considera usar un gestor de contraseñas para el equipo de desarrollo.