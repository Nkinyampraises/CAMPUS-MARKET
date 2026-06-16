// Local dev launcher: loads .env and derives DATABASE_URL from POSTGRES_* if needed.
import 'dotenv/config';

if (!process.env.DATABASE_URL && process.env.POSTGRES_HOST) {
  const {
    POSTGRES_USER = 'postgres',
    POSTGRES_PASSWORD = '',
    POSTGRES_HOST = 'localhost',
    POSTGRES_PORT = '5432',
    POSTGRES_DATABASE = 'postgres',
  } = process.env;
  process.env.DATABASE_URL = `postgresql://${POSTGRES_USER}:${encodeURIComponent(POSTGRES_PASSWORD)}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DATABASE}`;
}

process.env.PORT = process.env.PORT || '8002';

await import('../server-prod.js');
