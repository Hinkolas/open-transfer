import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transfers } from '$lib/server/db/schema';
import { deleteObject, headObject } from '$lib/server/s3';
import type { FinalizeTransferResponse } from '$lib/transfer';

export const POST: RequestHandler = async ({ params }) => {
	const [row] = await db.select().from(transfers).where(eq(transfers.id, params.id));
	if (!row) {
		return json({ message: 'Transfer not found' }, { status: 404 });
	}
	if (row.status === 'ready') {
		// double finalize (retry/double fire) — client treats 409 as success
		return json({ id: row.id, url: `/t/${row.id}` } satisfies FinalizeTransferResponse, {
			status: 409
		});
	}

	const head = await headObject(row.s3Key);
	if (!head) {
		return json({ message: 'No uploaded file found in storage' }, { status: 400 });
	}
	if (head.contentLength !== row.fileSize) {
		// declared size was a lie or the upload was corrupted — reject and clean up
		await deleteObject(row.s3Key);
		await db.delete(transfers).where(eq(transfers.id, row.id));
		return json({ message: 'Uploaded file does not match the declared size' }, { status: 400 });
	}

	await db.update(transfers).set({ status: 'ready' }).where(eq(transfers.id, row.id));

	return json({ id: row.id, url: `/t/${row.id}` } satisfies FinalizeTransferResponse);
};
