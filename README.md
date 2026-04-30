# CUNYPath Frontend

Standalone CUNYPath frontend for the Hunter CS planner.

This app is separate from the scraper workspace and is now centered on the live Supabase-backed
catalog, with local fallback metadata used only to keep roadmap grouping and prerequisite logic
stable when the live catalog is incomplete.

## Run

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

## Project Structure

- `src/` - React app source
- `src/data/supabaseCatalog.js` - live catalog loader
- `src/lib/` - catalog shaping, planner logic, Supabase client
- `src/components/` - planner UI
- `supabase/` - SQL for user planner state

## Notes

- `node_modules/` is intentionally kept so the app can run immediately.
- `dist/` is disposable build output and can always be regenerated with `npm run build`.
