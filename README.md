# Justice Watch Web Application

A multi-user web application for monitoring Maricopa County Justice Courts with comprehensive authentication and data export capabilities.

## Features

### 🔐 Multi-User Authentication System
- **User Registration**: Create accounts with email, password, and name
- **Secure Login**: JWT token-based authentication with session management
- **Role-Based Access**: Support for user, admin, and viewer roles
- **Password Validation**: Enforced strong passwords (8+ chars, uppercase, lowercase, number)
- **Protected Routes**: All dashboard routes require authentication
- **User Profile Display**: Shows logged-in user info in dashboard header
- **Session Persistence**: Stays logged in with JWT tokens

### 📊 Court Case Monitoring
- **Real-time Scraping**: Monitor 26 Maricopa County Justice Courts
- **Arraignment Focus**: Automatically finds and tracks arraignment hearings
- **Case Details**: View complete case information including:
  - Parties (plaintiffs, defendants, attorneys)
  - Charges with ARS codes and descriptions
  - Court calendar and hearing schedules
  - Case status and judge assignments
- **Smart Navigation**: Click-through court websites (no URL construction)

### 📈 Analytics Dashboard
- **Overview Tab**: Summary statistics and top charges
- **Cases Tab**: Full case listing with search and filters
- **Hearings Tab**: Upcoming and past hearings organized by date
- **Statistics Tab**: Court distribution and case metrics

### 📁 Data Export
- **CSV Export**: Detailed export with all case information
  - Flattened data structure for easy analysis
  - Includes parties, charges, and hearing info
  - Perfect for Excel analysis
- **PDF Export**: Beautiful formatted reports
  - Professional layout with case cards
  - Complete details for each case
  - Print-optimized with page breaks
  - Direct browser print to PDF

### 🎨 UI Enhancements
- **Modern Design**: Gradient backgrounds and smooth animations
- **Dark Mode Support**: Eye-friendly interface
- **Responsive Layout**: Works on desktop and tablet
- **Visual Calendar**: Color-coded hearing dates
- **Progress Indicators**: Real-time scraping status
- **Interactive Modals**: Detailed case view with organized sections

## Tech Stack

### Frontend
- **React 18**: Modern component-based UI
- **TypeScript**: Type-safe development
- **Vite**: Lightning-fast build tool
- **Chart.js**: Data visualization
- **Socket.io Client**: Real-time updates
- **React Router**: Client-side routing

### Backend  
- **Node.js & Express**: RESTful API server
- **PostgreSQL**: Relational database for case data
- **Redis**: Job queue and caching
- **Bull**: Background job processing
- **Socket.io**: WebSocket communication

### Authentication
- **JWT Tokens**: Stateless authentication
- **Express Sessions**: Server-side session management
- **Bcrypt**: Secure password hashing
- **Custom Validation**: Email and password requirements

### Scraping
- **Selenium WebDriver**: Browser automation
- **BeautifulSoup4**: HTML parsing
- **Python Integration**: Scraper scripts
- **Smart Navigation**: Click-based navigation (no URL construction)

### DevOps
- **Docker**: Containerization
- **Docker Compose**: Multi-container orchestration
- **GitHub Actions**: CI/CD pipeline
- **Environment Variables**: Secure configuration

## Export Features

### CSV Export
The CSV export provides comprehensive case data in a flat structure:
- **Basic Info**: Case number, court, title, type, status, judge
- **Parties**: All plaintiffs and defendants (semicolon-separated)
- **Attorneys**: Legal representation for each party
- **Charges**: Complete list with ARS codes and descriptions
- **Hearings**: Next hearing date and type
- **Metadata**: Filing date, total counts

### PDF Export  
Professional reports with:
- **Header**: Report title and generation timestamp
- **Summary**: Total cases, courts involved, date range
- **Case Cards**: Individual cards for each case with:
  - Gradient header with case number
  - Organized sections for all data
  - Color-coded elements
  - Print-optimized layout
- **Print Options**: Direct browser print to PDF

## Quick Start

### Using Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/arealicehole/justice-watch-app.git
cd justice-watch-app
git checkout web-app
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start with Docker Compose:
```bash
docker-compose up -d
```

4. Access the application:
- Frontend: http://localhost:5173
- API: http://localhost:3001

### Manual Setup

1. Install dependencies:
```bash
npm install
pip3 install -r requirements.txt
```

2. Set up PostgreSQL and Redis:
```bash
# Install PostgreSQL and Redis on your system
# Create database: justice_watch
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Run development servers:
```bash
npm run dev
```

## Deployment

### Production Build

```bash
# Build frontend
npm run build

# Build backend
npm run build:server

# Start production server
NODE_ENV=production npm start
```

### Deploy with Docker

```bash
# Build production image
docker build -t justice-watch-web .

# Run container
docker run -d \
  -p 3001:3001 \
  --env-file .env \
  justice-watch-web
```

### Deploy to Cloud

#### Heroku
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev
git push heroku web-app:main
```

#### AWS/Digital Ocean
1. Provision a VPS
2. Install Docker
3. Clone repository
4. Run Docker Compose with production config

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 3001 |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_NAME` | Database name | justice_watch |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `SESSION_SECRET` | Session encryption key | (required) |
| `JWT_SECRET` | JWT signing key | (required) |
| `REDIS_HOST` | Redis host | localhost |
| `REDIS_PORT` | Redis port | 6379 |

## API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Sign in
- `POST /api/auth/logout` - Sign out
- `GET /api/auth/status` - Check auth status

### Protected Endpoints (require authentication)

- `GET /api/cases` - List court cases
- `GET /api/cases/search` - Search cases
- `GET /api/cases/statistics` - Get statistics
- `POST /api/scraping/start` - Start scraping job
- `POST /api/scraping/stop` - Stop active job
- `GET /api/scraping/status` - Get job status
- `POST /api/export/csv` - Export to CSV
- `POST /api/export/json` - Export to JSON

## Authentication Flow

### User Registration
1. User provides email, password, and name
2. Password validated (8+ chars, uppercase, lowercase, number)
3. Password hashed with bcrypt
4. User record created in PostgreSQL
5. Session created and JWT token issued
6. Redirected to dashboard

### User Login
1. Email and password submitted
2. User lookup in database
3. Password verified against hash
4. Session created with user ID
5. JWT token generated (24hr expiry)
6. Token stored in localStorage
7. Redirected to protected dashboard

### Protected Routes
```javascript
// All routes require authentication
/cases       - View court cases
/dashboard   - Main dashboard
/statistics  - Analytics view
/hearings    - Upcoming hearings

// Public routes
/login       - Login/Register form
```

### User Roles
- **User**: Standard access, can view and export data
- **Admin**: Full access, can manage users and settings
- **Viewer**: Read-only access to dashboard

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);
```

### Cases Table (with user association)
```sql
CREATE TABLE cases (
    id SERIAL PRIMARY KEY,
    case_number VARCHAR(100) NOT NULL,
    court_name VARCHAR(255),
    case_title VARCHAR(500),
    -- ... other fields ...
    user_id INTEGER REFERENCES users(id),
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Security Features

### Password Security
- **Bcrypt hashing**: Industry-standard password hashing
- **Salt rounds**: 10 rounds for optimal security/performance
- **Validation rules**: 
  - Minimum 8 characters
  - At least one uppercase letter
  - At least one lowercase letter  
  - At least one number

### Session Management
- **JWT tokens**: Signed with secret key
- **24-hour expiry**: Automatic token refresh
- **Secure storage**: HttpOnly cookies for sessions
- **Logout**: Clears session and removes token

### API Security
- **Rate limiting**: 100 requests per 15 minutes per IP
- **CORS protection**: Configured origins only
- **Helmet.js**: XSS and other attack prevention
- **SQL injection prevention**: Parameterized queries
- **Input validation**: Server-side validation for all inputs

## Development

```bash
# Run tests
npm test

# Lint code
npm run lint

# Type check
npm run type-check
```

## License

MIT License - see LICENSE file for details

## Support

For issues or questions, please open an issue on GitHub.