# 🌌 AuroraCheck

Real-time aurora borealis forecast website with email alerts, live map, and admin dashboard.

**Live demo:** _coming soon_

---

## Features

- 🔍 **Location search** — search any city or use GPS to get instant aurora probability
- 📊 **Live forecast** — aurora % chance, Kp index, and cloud cover from free APIs
- 🗺️ **Live map** — real-time NOAA aurora oval overlaid on a world map
- 📧 **Email alerts** — subscribe with a custom threshold; get notified when aurora conditions are met at your location
- 🛠️ **Admin dashboard** — manage subscribers, view alert history, monitor space weather

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Node.js · Express |
| Database | SQLite |
| Email | Brevo (free tier — 300/day) |
| Aurora data | NOAA OVATION model (free, no key) |
| Weather | Open-Meteo (free, no key) |
| Hosting | Vercel (frontend) · Railway (backend) |

---

## Project structure

```
aurora-check/
├── aurora-forecast.html   # Main forecast page
├── aurora-map.html        # Live aurora map
├── aurora-admin.html      # Admin dashboard
└── aurora-backend/
    ├── src/
    │   ├── server.js      # Express server entry point
    │   ├── routes.js      # API endpoints
    │   ├── aurora.js      # NOAA + Open-Meteo data fetching
    │   ├── email.js       # Brevo email sender
    │   ├── cron.js        # Hourly alert cron job
    │   └── db.js          # SQLite setup
    ├── package.json
    └── .env.example
```

---

## Quick start

### Frontend
Just open `aurora-forecast.html` in your browser. By default it talks to `http://localhost:3001/api`.

### Backend
```bash
cd aurora-backend
npm install
cp .env.example .env
# Fill in BREVO_API_KEY and BREVO_SENDER_EMAIL in .env
npm run dev
```

The server starts on **http://localhost:3001**.

---

## Deployment

### Frontend → Vercel
```bash
npm install -g vercel
vercel --prod
```
Or drag and drop the HTML files at [vercel.com/new](https://vercel.com/new).

### Backend → Railway
```bash
npm install -g @railway/cli
cd aurora-backend
railway login
railway init
railway up
```
Add your environment variables in the Railway dashboard.

After deploying, update `API_BASE` in each HTML file to your Railway URL:
```js
const API_BASE = 'https://your-backend.up.railway.app/api';
```

### Domain (Namecheap → Vercel)
In Namecheap Advanced DNS, set:

| Type | Host | Value |
|---|---|---|
| A Record | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

Then add your domain in Vercel → Project → Settings → Domains.

---

## Environment variables

See [`aurora-backend/.env.example`](aurora-backend/.env.example) for all variables.

The only required ones to get started:
- `BREVO_API_KEY` — free at [brevo.com](https://brevo.com)
- `BREVO_SENDER_EMAIL` — verified sender in Brevo
- `FRONTEND_URL` — your deployed frontend URL

---

## Cost

Everything runs free to start:

| Service | Free tier |
|---|---|
| NOAA SWPC | Free forever |
| Open-Meteo | Free forever |
| Brevo | 300 emails/day |
| Vercel | Free hobby plan |
| Railway | ~$5/mo credit (plenty to start) |

---

## License

MIT
