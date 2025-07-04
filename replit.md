# QR Code Quest - Achievement Map Application

## Overview

This is a QR code-based treasure hunt application where users scan QR codes to unlock segments of a map and collect a sticker kit prize. The system manages user registration, progress tracking, QR code scanning, and prize redemption. It features both a user interface for scanning codes and an admin dashboard for managing the system.

## System Architecture

**Frontend Architecture:**
- React with TypeScript for the user interface
- Wouter for client-side routing 
- Tailwind CSS with shadcn/ui components for styling
- TanStack Query for state management and API calls
- HTML5 Canvas API with jsQR library for QR code scanning

**Backend Architecture:**
- Express.js server with TypeScript
- RESTful API endpoints for user management and QR operations
- Session-based request logging and error handling
- Vite development server integration with HMR support

**Database Architecture:**
- PostgreSQL with Drizzle ORM for type-safe database operations
- Neon serverless PostgreSQL for cloud hosting
- Connection pooling with pg for optimal performance

## Key Components

**User Management System:**
- Document number-based authentication (no passwords)
- Automatic user registration flow
- Session persistence with localStorage for returning users
- User context provider for global state management

**QR Code System:**
- Universal QR compatibility with URL format as default
- URL format enables scanning with native phone camera apps
- Automatic login and segment unlock from external QR scans
- Dedicated QRUnlockHandler for seamless external access
- Client-side QR scanning using device camera for legacy codes
- Security code validation for each map segment
- Real-time segment unlocking with visual feedback
- Progress tracking with completion detection
- Auto-redirect after QR scan to unlock segments

**QR Trap System (for Workplace Safety Training):**
- Trap QR codes for scenarios without actual safety risks
- False points system to create engaging risk identification training
- Admin controls to mark QR codes as "traps" via isTrap boolean field
- Separate trap points tracking independent of real progress
- Trap points ranking system for competitive learning
- Visual indicators in admin panel to identify trap QR codes
- Specialized responses for trap QR scans with custom messaging

**Admin Dashboard:**
- Protected admin routes with session authentication
- System configuration management (instructions, images, map layout)
- User progress monitoring and analytics
- Map segment asset management (images, URLs, metadata)
- QR code generation tools for testing

**Map Grid System:**
- Configurable grid layouts (3x3, 3x2, 2x3, 4x2, 2x4)
- Adjustable gap sizes between segments
- Dynamic segment loading from database assets
- Visual progress indicators and animations

**Prize System:**
- Automatic redemption code generation upon completion
- QR code format for prize codes
- Prize tracking and redemption status

## Data Flow

1. **User Registration/Login:**
   - User enters document number
   - System checks if user exists, creates new user if needed
   - User context updated, redirected to map

2. **QR Code Scanning:**
   - User activates camera scanner
   - QR code decoded to extract segment ID and security code
   - API call validates and unlocks segment
   - Map state updated with visual feedback

3. **Progress Tracking:**
   - Real-time progress bar updates
   - Completion detection triggers prize generation
   - Prize code displayed as QR and text format

4. **Admin Management:**
   - System configuration updates via rich text editor
   - Map segment asset CRUD operations
   - User analytics and progress monitoring

## External Dependencies

**Core Dependencies:**
- `@neondatabase/serverless` - Neon PostgreSQL client
- `drizzle-orm` - Type-safe ORM with migration support
- `@tanstack/react-query` - Server state management
- `@radix-ui/*` - Headless UI components
- `jsqr` - QR code scanning library
- `qrcode` - QR code generation
- `react-quill` - Rich text editing

**Development Tools:**
- `vite` - Build tool and development server
- `tsx` - TypeScript execution for development
- `esbuild` - Production build bundling
- `tailwindcss` - Utility-first CSS framework

**Replit Integration:**
- `@replit/vite-plugin-shadcn-theme-json` - Theme configuration
- `@replit/vite-plugin-runtime-error-modal` - Development error handling
- `@replit/vite-plugin-cartographer` - Development tooling

## Deployment Strategy

**Development Environment:**
- Replit with Node.js 20 runtime
- PostgreSQL 16 module for database
- Hot module replacement with Vite
- Automatic dependency installation

**Production Build:**
- Vite builds client to `dist/public`
- esbuild bundles server to `dist/index.js`
- Express serves static files and API routes
- Database migrations handled by Drizzle

**Environment Configuration:**
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Session encryption key
- `ADMIN_PASSWORD` - Admin panel access (optional)
- Port 5000 for local development
- Port 80 for external access via Replit

**Production Deployment:**
- Debian/Ubuntu server deployment guide: `DEPLOYMENT_GUIDE.md`
- Automated installation script: `deploy-debian.sh`
- PM2 process management with clustering
- Nginx reverse proxy with SSL support
- PostgreSQL 16 database with automated backups
- UFW firewall and Fail2Ban security
- Automated SSL certificates via Let's Encrypt

## User Preferences

Preferred communication style: Simple, everyday language.

## Changelog

Changelog:
- June 26, 2025. Initial setup
- June 26, 2025. Enhanced QR system with URL support for universal compatibility
- June 26, 2025. Completed end-to-end QR URL unlock flow with auto-login and seamless user experience
- June 26, 2025. Implemented QR trap codes system for workplace safety risk identification training
- June 26, 2025. Added false points ranking system and admin controls for trap QR management
- June 27, 2025. Fixed modalContent saving issue - iframe content now saves correctly in admin panel
- June 27, 2025. Reorganized admin segment configuration into organized tabs for better usability
- June 27, 2025. Fixed modal display issue - modals now appear correctly when unlocking segments with custom content
- June 27, 2025. Implemented complete frontend customization system - admin can now modify app titles, button texts, loading messages, and UI elements through dedicated "Personalización" tab with real-time persistence
- June 27, 2025. Added comprehensive image management to frontend customization - admin can now control banner/cobranding images, footer logos, site map images, and background textures with live previews
- June 27, 2025. Implemented gradient color selection system - admin can now customize background gradient colors with live preview and persistent storage
- June 27, 2025. Added complete login page customization through admin panel - admin can now personalize login titles, subtitles, welcome text, field labels, button text, logo image, and preload images
- June 27, 2025. Reorganized admin customization panel into dedicated tabs (Personalización, Imágenes, Colores, Página Login) eliminating parameter duplications and improving organization
- June 27, 2025. Implemented customizable preload and login images - BrainLoader component and AuthPage now dynamically load images from database configuration
- June 27, 2025. Fixed JSX syntax errors and eliminated duplicated background configuration options between "Personalización" and "Colores" tabs - consolidated all background settings (image URL, gradient colors, positioning) into the "Colores" tab for better organization
- June 27, 2025. Created comprehensive Debian deployment documentation including DEPLOYMENT_GUIDE.md with step-by-step instructions, automated deploy-debian.sh installation script, and DEPENDENCIES.md with complete dependency list for production server deployment
- July 4, 2025. Replaced MapPage header title with configurable logo - added headerLogoImageUrl field to database schema, updated storage interface, created admin panel configuration in Images tab, and fixed frontend state management to properly display custom header logos