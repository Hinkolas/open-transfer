import { building, dev } from '$app/environment';
import type { ServerInit } from '@sveltejs/kit';

export const init: ServerInit = async () => {
	if (building) return;
	// dynamic import so `vite build` never evaluates the db module (it throws without DATABASE_URL)
	const { runMigrations } = await import('$lib/server/db/migrate');
	try {
		await runMigrations();
	} catch (err) {
		// in dev the UI should still come up without a reachable database
		if (!dev) throw err;
		console.warn('[dev] skipping migrations — database not reachable:', err);
	}
};
