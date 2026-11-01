# Spare database (Supabase)

The app runs on **Neon**. On the free plan, if Neon's monthly hours run out, the database is
suspended until the next month and can't be read. So a **spare copy on Supabase** is kept up
to date every night, ready to switch to.

- `backend/scripts/copy-db.js` copies every table from one Postgres database to another.
- `.github/workflows/sync-spare-db.yml` runs that copy every night at 02:17 UTC.

## One-time setup (about 10 minutes)

1. **Create the Supabase project.** Go to [supabase.com](https://supabase.com) → New project.
   Choose a strong database password and save it. Pick the region closest to Render's.
2. **Get its connection string.** In the project, click **Connect**. Copy the
   **Session pooler** string (host ends in `pooler.supabase.com`, port `5432`) and put your
   password in it. Use the Session pooler: the "Direct connection" address only works over
   IPv6, which Render and GitHub can't always reach.
3. **Get Neon's connection string.** In Neon → Connect, copy the string with
   **Connection pooling turned off** (the host has no `-pooler`).
4. **Add both as GitHub secrets.** Repository → Settings → Secrets and variables → Actions →
   New repository secret:
   - `MAIN_DATABASE_URL` = the Neon string
   - `SPARE_DATABASE_URL` = the Supabase string
5. **Run the first copy now.** Repository → Actions → *Sync spare database* → Run workflow.
   When it turns green, open Supabase → Table Editor: the tables and rows are there.

After that it refreshes itself every night, which also keeps the free Supabase project from
being paused for inactivity.

## Switching to the spare

Do this if Neon runs out, or is down.

1. Render → your backend service → **Environment**. Set **both** `DATABASE_URL` and
   `DIRECT_URL` to the Supabase Session pooler string, then **Save**. Render restarts.
2. Sign in to the app and check that it works.
3. Stop the nightly copy: GitHub → Actions → *Sync spare database* → **⋯** → **Disable
   workflow**.

The copy also checks this on its own: it will not overwrite a database that has newer data
than the one it copies from.

You lose at most the attendance taken since the last nightly copy. If Neon can still be read
when you switch, run the copy one last time first (Actions → Run workflow).

## Moving back to Neon later

Run the copy in the other direction from a computer with the backend installed:

```bash
cd backend
npm run copy-db -- --from "<supabase string>" --to "<neon string>" --replace
```

Then point Render back at Neon, and re-enable the workflow.

## What the copy does

- Builds the tables on the target with the project's own migrations.
- Copies everything in one transaction. If anything fails, the target is left exactly as it was.
- Refuses to write into a database that already has data, unless `--replace` is given.
- Even with `--replace`, refuses when the target has newer data than the source.
- On Supabase, turns on row level security, so the tables can't be read through Supabase's
  public Data API. The app connects as the tables' owner, which is not affected.
