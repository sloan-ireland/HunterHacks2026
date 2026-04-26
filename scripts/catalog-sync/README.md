# Catalog Sync

Backend-only scripts for scraping Hunter course data from CUNY Global Search, normalizing it, and importing it into Supabase.

## Setup

```powershell
cd scripts/catalog-sync
npm install
```

Create a local `.env` file in this folder when importing to Supabase:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Never expose the service role key in the frontend or in `VITE_` environment variables.

## Commands

```powershell
npm run scrape
npm run normalize
npm run dry-run
npm run import
```

To run the full pipeline:

```powershell
npm run sync
```

The generated `courses.json` and `normalized-courses.json` files are ignored by Git.

## Schema

Run the SQL files in `../../supabase/schema/` in numeric order before the first import:

```text
001_catalog_tables.sql
002_user_planner_state.sql
```
