# Justice Watch Arizona

A serverless web application for tracking Maricopa County court arraignments. Automatically scrapes court data daily and presents it in a clean, searchable interface.

## Architecture

- **Frontend**: React + TypeScript deployed on Netlify
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Scraper**: Python + Selenium running on GitHub Actions
- **Cost**: $0/month (fully serverless)

## Features

- Daily automated court scraping (9 AM MST, Monday-Friday)
- Real-time updates via WebSocket subscriptions
- Case search and filtering
- Export to CSV/PDF
- Mobile-responsive design
- Public access (no authentication required)

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.9+
- Supabase CLI (via npx)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/justice-watch-az/web-app.git
cd web-app
```

2. Install dependencies:
```bash
npm install
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Start local Supabase:
```bash
npx supabase start
```

5. Run the frontend:
```bash
npm run dev
```

## Production Deployment

### Frontend (Netlify)

The frontend automatically deploys from the `main` branch via Netlify's GitHub integration.

### Database (Supabase)

Production database is hosted on Supabase Cloud. Schema migrations are in `supabase/migrations/`.

### Scraper (GitHub Actions)

The scraper runs automatically via GitHub Actions on a schedule (Monday-Friday, 9 AM MST).

## Project Structure

```
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── services/          # API services
│   └── types/             # TypeScript types
├── scrapers/              # Court scraper
│   ├── maricopa_arraignment_scraper.py
│   └── supabase_writer.py
├── supabase/              # Database configuration
│   └── migrations/        # Schema migrations
├── .github/workflows/     # GitHub Actions
│   └── scraper-schedule.yml
└── netlify.toml          # Netlify configuration
```

## Environment Variables

### Frontend (.env)
```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### GitHub Actions Secrets
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
```

## License

MIT License - See LICENSE file for details

## Support

For issues or questions, please open an issue on GitHub.