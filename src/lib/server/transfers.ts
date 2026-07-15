import { randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { transfers, type Transfer } from '$lib/server/db/schema';
import { deleteObject } from '$lib/server/s3';

// Pending rows are upload sessions that never finalized (closed tab, failed PUT).
// They are reaped lazily on access and by sweepStalePending() — no cron needed.
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;

export function newTransferId(): string {
	return randomBytes(18).toString('base64url');
}

export type TransferLookup =
	{ kind: 'not_found' } | { kind: 'expired' } | { kind: 'ready'; transfer: Transfer };

export async function loadTransfer(id: string): Promise<TransferLookup> {
	const [row] = await db.select().from(transfers).where(eq(transfers.id, id));
	if (!row) return { kind: 'not_found' };
	if (row.status === 'pending') {
		if (Date.now() - row.createdAt.getTime() > PENDING_TTL_MS) {
			await deleteObject(row.s3Key);
			await db.delete(transfers).where(eq(transfers.id, id));
		}
		// links are never shared before finalize, so pending reads as not found
		return { kind: 'not_found' };
	}
	if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
		// idempotent no-op when the object is already gone
		await deleteObject(row.s3Key);
		return { kind: 'expired' };
	}
	return { kind: 'ready', transfer: row };
}

export async function sweepStalePending(): Promise<void> {
	try {
		const cutoff = new Date(Date.now() - PENDING_TTL_MS);
		const stale = await db
			.select({ id: transfers.id, s3Key: transfers.s3Key })
			.from(transfers)
			.where(and(eq(transfers.status, 'pending'), lt(transfers.createdAt, cutoff)))
			.limit(10);
		for (const row of stale) {
			await deleteObject(row.s3Key);
			await db.delete(transfers).where(eq(transfers.id, row.id));
		}
	} catch (err) {
		console.error('sweepStalePending failed', err);
	}
}
