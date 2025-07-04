#!/bin/bash

# QR Code Quest - Script de Instalación Automatizada para Debian
# Versión: 1.0
# Fecha: 2025-01-27

set -e  # Salir si cualquier comando falla

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Variables por defecto
APP_USER="qrcodequest"
APP_DIR="/var/www/qrcodequest"
DB_NAME="qrcodequest"
DB_USER="qrcodequest"
DOMAIN=""
EMAIL=""

# Función para mostrar ayuda
show_help() {
    cat << EOF
Uso: $0 [opciones]

Opciones:
    -d, --domain DOMAIN      Dominio para SSL (ej: ejemplo.com)
    -e, --email EMAIL        Email para certificados SSL
    -h, --help              Mostrar esta ayuda

Ejemplo:
    $0 -d midominio.com -e admin@midominio.com
EOF
}

# Procesar argumentos
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -e|--email)
            EMAIL="$2"
            shift 2
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Opción desconocida: $1"
            show_help
            exit 1
            ;;
    esac
done

# Verificar si se ejecuta como root
if [[ $EUID -ne 0 ]]; then
   log_error "Este script debe ejecutarse como root (usar sudo)"
   exit 1
fi

log_info "Iniciando instalación de QR Code Quest en Debian..."

# 1. Actualizar sistema
log_info "Actualizando sistema..."
apt update && apt upgrade -y

# 2. Instalar herramientas básicas
log_info "Instalando herramientas básicas..."
apt install -y curl wget git build-essential software-properties-common \
    ufw fail2ban htop nano vim

# 3. Instalar Node.js 20.x
log_info "Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar instalación de Node.js
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log_success "Node.js instalado: $NODE_VERSION"
log_success "NPM instalado: $NPM_VERSION"

# 4. Instalar PostgreSQL 16
log_info "Instalando PostgreSQL 16..."
sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
apt update
apt install -y postgresql-16 postgresql-client-16 postgresql-contrib-16

# 5. Instalar PM2
log_info "Instalando PM2..."
npm install -g pm2

# 6. Instalar Nginx
log_info "Instalando Nginx..."
apt install -y nginx
systemctl enable nginx
systemctl start nginx

# 7. Instalar Certbot (si se proporcionó dominio)
if [[ -n "$DOMAIN" ]]; then
    log_info "Instalando Certbot para SSL..."
    apt install -y certbot python3-certbot-nginx
fi

# 8. Crear usuario del sistema
log_info "Creando usuario del sistema: $APP_USER"
if ! id "$APP_USER" &>/dev/null; then
    adduser --system --group --home "$APP_DIR" "$APP_USER"
fi
mkdir -p "$APP_DIR"
chown "$APP_USER:$APP_USER" "$APP_DIR"

# 9. Solicitar contraseñas de forma segura
log_info "Configuración de base de datos requerida..."
echo -n "Ingrese contraseña para el usuario de base de datos '$DB_USER': "
read -s DB_PASSWORD
echo

echo -n "Ingrese una clave secreta para las sesiones (mínimo 32 caracteres): "
read -s SESSION_SECRET
echo

if [[ -n "$DOMAIN" ]]; then
    echo -n "Ingrese contraseña para el administrador de la aplicación: "
    read -s ADMIN_PASSWORD
    echo
fi

# 10. Configurar PostgreSQL
log_info "Configurando PostgreSQL..."
sudo -u postgres createuser --createdb "$DB_USER" || true
sudo -u postgres psql -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres createdb -O "$DB_USER" "$DB_NAME" || true

# 11. Configurar variables de entorno
log_info "Configurando variables de entorno..."
cat > "$APP_DIR/.env" << EOF
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME
SESSION_SECRET=$SESSION_SECRET
$(if [[ -n "$ADMIN_PASSWORD" ]]; then echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"; fi)
EOF

chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
chmod 600 "$APP_DIR/.env"

# 12. Configurar PM2
log_info "Configurando PM2..."
cat > "$APP_DIR/ecosystem.config.js" << 'EOF'
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
EOF

# 13. Crear directorio de logs
sudo -u "$APP_USER" mkdir -p "$APP_DIR/logs"

# 14. Configurar Nginx
log_info "Configurando Nginx..."
NGINX_CONFIG="/etc/nginx/sites-available/qrcodequest"

cat > "$NGINX_CONFIG" << EOF
server {
    listen 80;
    server_name ${DOMAIN:-localhost};

    access_log /var/log/nginx/qrcodequest_access.log;
    error_log /var/log/nginx/qrcodequest_error.log;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
        proxy_read_timeout 300;
        send_timeout 300;
    }

    location /static/ {
        alias /var/www/qrcodequest/dist/public/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
    
    client_max_body_size 10M;
}
EOF

# Habilitar sitio
ln -sf "$NGINX_CONFIG" /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 15. Configurar Firewall
log_info "Configurando firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# 16. Configurar Fail2Ban
log_info "Configurando Fail2Ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
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
EOF

systemctl enable fail2ban
systemctl start fail2ban

# 17. Crear scripts de mantenimiento
log_info "Creando scripts de mantenimiento..."

# Script de backup
cat > /usr/local/bin/backup-qrcodequest.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/qrcodequest"
DATE=$(date +%Y%m%d_%H%M%S)
DATABASE="qrcodequest"
USER="qrcodequest"

mkdir -p $BACKUP_DIR
export PGPASSWORD=$(grep DATABASE_URL /var/www/qrcodequest/.env | cut -d':' -f3 | cut -d'@' -f1)
pg_dump -h localhost -U $USER -d $DATABASE > $BACKUP_DIR/qrcodequest_$DATE.sql
find $BACKUP_DIR -name "qrcodequest_*.sql" -mtime +7 -delete
echo "Backup completed: qrcodequest_$DATE.sql"
EOF

chmod +x /usr/local/bin/backup-qrcodequest.sh

# Script de actualización
cat > /usr/local/bin/update-qrcodequest.sh << 'EOF'
#!/bin/bash
APP_DIR="/var/www/qrcodequest"
USER="qrcodequest"

echo "Updating QR Code Quest application..."
cd $APP_DIR

/usr/local/bin/backup-qrcodequest.sh
sudo -u $USER pm2 stop qr-code-quest

if [ -d ".git" ]; then
    sudo -u $USER git pull
fi

sudo -u $USER npm install
sudo -u $USER npm run build
sudo -u $USER npm run db:push
sudo -u $USER pm2 restart qr-code-quest

echo "Update completed successfully!"
EOF

chmod +x /usr/local/bin/update-qrcodequest.sh

# 18. Configurar cron jobs
log_info "Configurando tareas programadas..."
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-qrcodequest.sh") | crontab -

# 19. Configurar SSL si se proporcionó dominio
if [[ -n "$DOMAIN" ]] && [[ -n "$EMAIL" ]]; then
    log_info "Configurando SSL para $DOMAIN..."
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL"
    
    # Configurar renovación automática
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
fi

# 20. Mostrar instrucciones finales
log_success "¡Instalación completada!"
echo
log_info "Pasos siguientes para completar el despliegue:"
echo "1. Copie su código fuente a: $APP_DIR"
echo "2. Como usuario $APP_USER, ejecute:"
echo "   cd $APP_DIR"
echo "   npm install"
echo "   npm run build"
echo "   npm run db:push"
echo "   pm2 start ecosystem.config.js"
echo "   pm2 save"
echo "   pm2 startup"
echo
log_info "URLs de acceso:"
if [[ -n "$DOMAIN" ]]; then
    echo "- Aplicación: https://$DOMAIN"
else
    echo "- Aplicación: http://$(hostname -I | awk '{print $1}'):80"
fi
echo
log_info "Credenciales de base de datos:"
echo "- Usuario: $DB_USER"
echo "- Base de datos: $DB_NAME"
echo "- Host: localhost:5432"
echo
log_info "Comandos útiles:"
echo "- Ver logs: sudo -u $APP_USER pm2 logs qr-code-quest"
echo "- Estado: sudo -u $APP_USER pm2 status"
echo "- Backup: /usr/local/bin/backup-qrcodequest.sh"
echo "- Actualizar: /usr/local/bin/update-qrcodequest.sh"
echo
log_warning "IMPORTANTE: Guarde de forma segura las contraseñas configuradas"