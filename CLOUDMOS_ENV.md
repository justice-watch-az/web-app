# Cloudmos Environment Variables

When deploying to Akash via Cloudmos, add these environment variables in the deployment form:

## Required Variables

```
SUPABASE_URL=https://tsgvxobkmmvsbjzxvuas.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
DATABASE_URL=postgresql://postgres.tsgvxobkmmvsbjzxvuas:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true
JWT_SECRET=generate_a_secure_jwt_secret_here
SESSION_SECRET=generate_a_secure_session_secret_here
```

## Optional Variables

```
NODE_ENV=production
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

## To Generate Secrets

```bash
# Generate JWT Secret
openssl rand -base64 32

# Generate Session Secret
openssl rand -base64 32
```

## Notes

- The app uses Supabase cloud database - no local storage needed
- Redis is included in the Docker image (for single container deployment)
- Default admin credentials will need to be created after deployment
- Health check endpoint: /health