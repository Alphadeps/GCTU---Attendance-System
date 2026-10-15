# Moving the database to Neon

## 1. Create the Neon database
1. Sign up at https://neon.tech and create a project (pick the region closest to your Render service, PostgreSQL 17).
2. On the project dashboard click **Connect** and copy two connection strings:
   - **Pooled** (the "Connection pooling" toggle ON, host contains `-pooler`) → this becomes `DATABASE_URL`
   - **Direct** (toggle OFF, no `-pooler`) → this becomes `DIRECT_URL`

## 2. Copy the data
Do this when nobody is using the system (no open sessions).

On a computer with PostgreSQL 17 client tools (`pg_dump`, `pg_restore`, `psql`):

```bash
cd backend
OLD_DB_URL="<current DIRECT_URL from Render>" \
NEW_DB_URL="<Neon DIRECT url>" \
bash scripts/migrate-to-neon.sh
```

The script dumps everything (including migration history), restores it into Neon, and prints row counts for both databases. Every row should say `ok`.

## 3. Point the backend at Neon
In Render → backend service → **Environment**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL (`...-pooler...`) |
| `DIRECT_URL` | Neon **direct** URL |
| `DB_POOL_MAX` | `10` (or remove it; 10 is the default) |

Save → Render redeploys. On start, `migrate-prod.js` runs `prisma migrate deploy` over `DIRECT_URL`; it should report no pending migrations.

## 4. Check it works
- `GET /api/health` returns `"database": "CONNECTED"`.
- Log in as admin and a rep, confirm classes/students/history are there.
- Open a session as a rep and check in as a student.

## Rolling back
Put the old `DATABASE_URL` / `DIRECT_URL` values back in Render. The old database is untouched by the migration.
