# 🚀 Alamquant Training Platform – Backend (Production v3)

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
| NODE_ENV | 'production' or 'development' |
| LOG_LEVEL | debug, info, warn, error |

## Default Admin
- Username: `admin`
- Password: `admin123`
- **Change after first login!**

## PM2 (Production)
```bash
npm run pm2:start
npm run pm2:stop
npm run pm2:restart
```

## Logs
Logs are stored in `./logs/` directory.
