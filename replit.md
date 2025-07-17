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
- Venue/location management with independent ranking systems
- CRUD operations for venues with status and participant limits

**Map Grid System:**
- Configurable grid layouts (3x3, 3x2, 2x3, 4x2, 2x4)
- Adjustable gap sizes between segments
- Dynamic segment loading from database assets
- Visual progress indicators and animations

**Venue Management System:**
- Multi-location support with independent user tracking
- CRUD operations for venue creation, editing, and deletion
- Venue-specific user rankings and progress tracking
- Configurable participant limits and active/inactive status
- Location-based data segregation for competitive activities

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
- July 4, 2025. Added header logo size control to admin dashboard - created headerLogoSize field in database schema with admin panel control (16-128px range) and dynamic sizing in MapPage header with live preview
- July 4, 2025. Fixed image loading flash issues - implemented proper image preloading in BrainLoader, AuthPage login logo, MapPage footer logo, and RegistrationPage to eliminate old image flash during loading transitions
- July 4, 2025. Updated RegistrationPage with dashboard styling - integrated system configuration loading, applied consistent map-page-bg styling, implemented proper image preloading, and made all text labels configurable through admin panel
- July 4, 2025. Defined comprehensive 5-image administration system - added registrationImageUrl database field, reorganized admin Images tab with color-coded sections for: 1) Login image, 2) Registration image, 3) Header logo (with size control), 4) Footer image, 5) Site map image, and 6) Banner/cobranding image
- July 15, 2025. Implemented complete venue management system - added venues table to database schema with CRUD operations, created new "Sedes" admin tab with full venue management interface, implemented venue-specific user rankings, and added API endpoints for venue operations with proper validation
- July 15, 2025. Fixed venue creation form bug in admin panel - corrected API request format in handleVenueCreate and handleVenueUpdate functions, added venue selection dropdown to user registration form with active venues only, and completed full venue-user relationship system with proper validation
- July 15, 2025. Implemented complete trap penalty system with 0.5-point deduction per trap code scanned, fixed scoring calculation in venue ranking system, and verified proper functioning of scoring formula: (unlocked segments - trap penalties × 0.5)
- July 15, 2025. Enhanced login form validation and error handling - improved document number validation, added protection against double submission, implemented proper error state management, and improved form state consistency to resolve "invalid document" error on first attempt
- July 15, 2025. Implemented robust session persistence system - added automatic session recovery on app startup, consistent localStorage key management throughout the system, QR parameter preservation for non-authenticated users, and seamless redirection after login while maintaining QR scan parameters for proper point attribution
- July 15, 2025. Created customizable messaging system for achievements and traps - added achievementUnlockedTitle, achievementUnlockedMessage, trapDetectedTitle, and trapDetectedMessage fields to database schema, implemented message editor in admin panel "Personalización" tab with dynamic placeholders ({segmentId}, {trapPoints}), and updated QRUnlockHandler to use configurable messages with real-time formatting
- July 17, 2025. Fixed achievement and trap message display issue - messages are now properly stored in database and correctly applied to player's view. Updated QRUnlockHandler to wait for system configuration loading before processing QR codes, enhanced MapPage to use custom messages from system configuration for both in-app scanning and external QR scanning, and implemented proper message formatting with placeholder replacement ({segmentId}, {trapPoints}) for both achievement and trap scenarios
- July 17, 2025. Fixed segment creation and editing functionality - resolved issue where creating new segments failed due to hardcoded segment ID 1 collision. Implemented dynamic segment ID assignment to find next available ID. Enhanced error handling for both create and edit operations with proper API response validation and clearer error messages to users
- July 17, 2025. Implemented sophisticated ranking system with multi-criteria sorting: 1) Total score (correct codes × 10 - trap codes × 5), 2) Completion date (earlier first), 3) Fewer trap codes. Fixed completedAt timestamp updating for users who reach 100% completion
- July 17, 2025. Fixed Flash of Unstyled Content (FOUC) issue - eliminated default style loading before database parameters by implementing synchronous system config loading in main.tsx. Removed duplicate CSS variable definitions and ensured consistent styling from first render. This prevents momentary display of hardcoded default colors/images before database configuration loads
- July 17, 2025. Fixed critical segment unlocking bug - resolved issue where previously scanned QR codes showed success message but segments remained locked in map view. Problem was that alreadyScanned responses weren't calling unlockSegment() to populate map_segments table. Updated server routes to ensure segments are properly unlocked even for previously scanned QR codes, and enhanced client-side state management to handle alreadyScanned responses correctly
- July 17, 2025. Fixed database styling override issue - eliminated hardcoded default styles in main.tsx and index.css that were overriding database customizations. Modified initializeStyles() to use ONLY database values without fallback to hardcoded defaults. This ensures custom styling from admin panel persists even when code changes are made to the application