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
| VERCEL_BLOB_READ_WRITE_TOKEN | Vercel Blob token (public store) |
| JWT_SECRET | Secret key for JWT (change this!) |
| PORT | Server port (default 5000) |
| FRONTEND_URL | Frontend URL for CORS |
| LOG_LEVEL | Log level (debug/info/warn/error) |

## Default Admin
- Username: `admin`
- Password: `admin123`
- **Change after first login!**

## Production Notes
- All routes are validated with express-validator.
- Rate limiting is applied per IP (100 requests per 15 min).
- Helmet CSP is configured for inline scripts, Binance WebSocket, and CDN resources.
- Trade engine uses cached prices (updated every 3 sec).
- Cron job updates public candles every 5 minutes.
- Graceful shutdown on SIGTERM.
- Winston logging (error.log, combined.log).
