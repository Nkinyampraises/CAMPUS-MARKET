
  # Untitled

  This is a code bundle for Untitled. The original project is available at https://www.figma.com/design/Z2iFUnL6kbPX1vrZcXacWr/Untitled.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.
  # CAMPUS-MARKET

## Server data storage

- Business data now reads and writes through Postgres via the server KV layer.
- Configure Postgres with `DATABASE_URL`, or with `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DATABASE`.
- Optional: set `KV_STORE_TABLE` if your migrated data lives in a table other than `kv_store_50b25a4f`.
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are now only needed if you still want to keep the existing Supabase auth and upload flows during the transition.
