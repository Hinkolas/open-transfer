import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { loadTransfer } from '$lib/server/transfers';

export const load: PageServerLoad = async ({ params }) => {
	const lookup = await loadTransfer(params.id);
	if (lookup.kind === 'not_found') error(404, 'Transfer not found');
	if (lookup.kind === 'expired') error(410, 'This transfer has expired');

	const t = lookup.transfer;
	// metadata only — the S3 key/URL never reaches the client from here
	return {
		id: t.id,
		fileName: t.fileName,
		fileSize: t.fileSize,
		message: t.message,
		expiresAt: t.expiresAt?.toISOString() ?? null,
		requiresPassword: t.passwordHash !== null
	};
};
