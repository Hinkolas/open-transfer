import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';

type Database = ReturnType<typeof createDb>;

function createDb() {
	if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
	return drizzle(postgres(env.DATABASE_URL), { schema });
}

let instance: Database | undefined;

// Lazy proxy: creating the client at import time would make the build's
// analyse step (which imports every server chunk) require a valid DATABASE_URL.
export const db: Database = new Proxy({} as Database, {
	get(_, prop) {
		instance ??= createDb();
		const value = Reflect.get(instance, prop, instance);
		return typeof value === 'function' ? value.bind(instance) : value;
	}
});
