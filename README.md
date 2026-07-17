# 🚀 Alamquant Training Platform – Backend

## Quick Start
```bash
npm install
npm run migrate
npm start
```

## Environment Variables (.env)
| Variable | Description |
|---|---|
| DATABASE_URL | Neon DB PostgreSQL connection string |
| VERCEL_BLOB_READ_WRITE_TOKEN | Vercel Blob token for file uploads |
| JWT_SECRET | Secret key for JWT (change this!) |
| FINNHUB_API_KEY | Finnhub API key for real-time prices |
| PORT | Server port (default 5000) |
| FRONTEND_URL | Frontend URL for CORS |

## Default Admin
- Username: `admin`
- Password: `admin123`
- **Change after first login!**
