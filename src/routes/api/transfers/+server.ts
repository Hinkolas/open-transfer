import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { transfers } from '$lib/server/db/schema';
import { hashPassword } from '$lib/server/password';
import { createUploadUrl } from '$lib/server/s3';
import { newTransferId, sweepStalePending } from '$lib/server/transfers';
import {
	EXPIRY_OPTIONS,
	MAX_FILE_SIZE,
	type CreateTransferRequest,
	type CreateTransferResponse
} from '$lib/transfer';

export const POST: RequestHandler = async ({ request }) => {
	let body: Partial<CreateTransferRequest>;
	try {
		body = await request.json();
	} catch {
		return json({ message: 'Invalid JSON body' }, { status: 400 });
	}

	const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
	if (!fileName || fileName.length > 255) {
		return json({ message: 'File name must be between 1 and 255 characters' }, { status: 400 });
	}

	const fileSize = body.fileSize;
	if (typeof fileSize !== 'number' || !Number.isSafeInteger(fileSize) || fileSize <= 0) {
		return json({ message: 'File size must be a positive integer' }, { status: 400 });
	}
	if (fileSize > MAX_FILE_SIZE) {
		return json({ message: 'File exceeds the 3 GB limit' }, { status: 400 });
	}

	const expiry = EXPIRY_OPTIONS.find((o) => o.value === body.expiry);
	if (!expiry) {
		return json({ message: 'Invalid expiry option' }, { status: 400 });
	}

	const message = typeof body.message === 'string' ? body.message.trim() : '';
	if (message.length > 4096) {
		return json({ message: 'Message must be at most 4096 characters' }, { status: 400 });
	}

	const password = typeof body.password === 'string' ? body.password : '';
	if (password.length > 256) {
		return json({ message: 'Password must be at most 256 characters' }, { status: 400 });
	}

	const id = newTransferId();
	const s3Key = `transfers/${id}`;

	await db.insert(transfers).values({
		id,
		fileName,
		fileSize,
		s3Key,
		message: message || null,
		passwordHash: password ? await hashPassword(password) : null,
		expiresAt: expiry.seconds === null ? null : new Date(Date.now() + expiry.seconds * 1000)
	});

	const uploadUrl = await createUploadUrl(s3Key);

	// lazy reaping of abandoned upload sessions; intentionally not awaited
	void sweepStalePending();

	return json({ id, uploadUrl } satisfies CreateTransferResponse, { status: 201 });
};
