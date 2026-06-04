# Recently Funded Startups (No Auth)

A simple app to view recently funded startups.

## Features

- No authentication or login
- Live funding/news feed ingestion (FinSMEs and TechCrunch funding tag)
- Public API endpoint: `/api/startups`
- Manual refresh endpoint: `/api/startups/refresh`
- Search and filter by sector
- Mobile-friendly UI

## Tech Stack

- Node.js + Express
- Plain HTML/CSS/JavaScript frontend
- RSS feeds with automatic server refresh every 15 minutes
- Local JSON fallback source when live feeds fail

## Run Locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the app:

   ```bash
   npm start
   ```

3. Open:

   ```
   http://localhost:3000
   ```

## Data

Startup records are stored in:

- `data/startups.json`

This local file is now used as fallback data if live feed fetching fails.
