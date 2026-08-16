import { getDb, closeDb } from '../src/lib/db';
import { config } from '../src/lib/config';

// Run migrations to initialize a fresh DB. Usage: npm run db:migrate
getDb();
console.log('Database migrated at', config.dbPath);
closeDb();
