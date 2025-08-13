# Justice Watch Web Application

A password-protected web application for monitoring Maricopa County Justice Courts.

## Features

- 🔐 Secure authentication system
- 📊 Real-time court case monitoring
- 📈 Statistics and analytics dashboard
- 📁 Export data to CSV/JSON
- 🔄 Automated scraping with job queue
- 🐳 Docker containerization
- ⚡ Fast React frontend with Vite

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Chart.js
- **Backend**: Node.js, Express, PostgreSQL
- **Authentication**: JWT + Sessions
- **Job Queue**: Bull + Redis
- **Containerization**: Docker & Docker Compose

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

## Security

- Password hashing with bcrypt
- JWT tokens with expiration
- Session management
- Rate limiting
- CORS protection
- SQL injection prevention
- XSS protection with helmet

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