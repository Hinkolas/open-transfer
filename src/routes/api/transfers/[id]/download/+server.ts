import { json } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transfers } from '$lib/server/db/schema';
import { verifyPassword } from '$lib/server/password';
import { createDownloadUrl, DOWNLOAD_URL_TTL } from '$lib/server/s3';
import { loadTransfer } from '$lib/server/transfers';
import type { DownloadResponse } from '$lib/transfer';

const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = 15 * 60 * 1000;

export const POST: RequestHandler = async ({ params, request }) => {
	const lookup = await loadTransfer(params.id);
	if (lookup.kind === 'not_found') {
		return json({ message: 'Transfer not found' }, { status: 404 });
	}
	if (lookup.kind === 'expired') {
		return json({ message: 'This transfer has expired' }, { status: 410 });
	}
	const transfer = lookup.transfer;

	let password: string | undefined;
	try {
		const body = await request.json();
		if (typeof body?.password === 'string') password = body.password;
	} catch {
		// no/invalid body is fine for unprotected transfers
	}

	if (transfer.passwordHash) {
		// fixed-window rate limit persisted on the row; the read-modify-write race
		// between concurrent guesses is acceptable for a demo
		const now = new Date();
		let attempts = transfer.verifyAttempts;
		let windowStart = transfer.verifyWindowStart;
		if (!windowStart || now.getTime() - windowStart.getTime() > VERIFY_WINDOW_MS) {
			attempts = 0;
			windowStart = now;
		}
		if (attempts >= MAX_VERIFY_ATTEMPTS) {
			const retryAfterSeconds = Math.max(
				1,
				Math.ceil((windowStart.getTime() + VERIFY_WINDOW_MS - now.getTime()) / 1000)
			);
			return json(
				{ message: 'Too many attempts, try again later', retryAfterSeconds },
				{ status: 429 }
			);
		}

		const valid = password ? await verifyPassword(password, transfer.passwordHash) : false;
		if (!valid) {
			await db
				.update(transfers)
				.set({ verifyAttempts: attempts + 1, verifyWindowStart: windowStart })
				.where(eq(transfers.id, transfer.id));
			return json(
				{
					message: password ? 'Incorrect password' : 'Password required',
					attemptsRemaining: MAX_VERIFY_ATTEMPTS - attempts - 1
				},
				{ status: 403 }
			);
		}

		await db
			.update(transfers)
			.set({ verifyAttempts: 0, verifyWindowStart: null })
			.where(eq(transfers.id, transfer.id));
	}

	const downloadUrl = await createDownloadUrl(transfer.s3Key, transfer.fileName);
	await db
		.update(transfers)
		.set({ downloadCount: sql`${transfers.downloadCount} + 1` })
		.where(eq(transfers.id, transfer.id));

	return json({ downloadUrl, expiresIn: DOWNLOAD_URL_TTL } satisfies DownloadResponse);
};
