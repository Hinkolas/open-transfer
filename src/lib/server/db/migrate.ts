import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';

export async function runMigrations(): Promise<void> {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	const client = postgres(env.DATABASE_URL, { max: 1, onnotice: () => {} });
	try {
		// cwd-relative: resolves to the repo root in dev and /app in the container
		await migrate(drizzle(client), { migrationsFolder: 'drizzle' });
	} finally {
		await client.end();
	}
}
