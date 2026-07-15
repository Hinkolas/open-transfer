import { bigint, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const transfers = pgTable('transfers', {
	id: text('id').primaryKey(),
	fileName: text('file_name').notNull(),
	// 3 GB max fits comfortably in a JS number, so mode 'number' keeps JSON serialization trivial
	fileSize: bigint('file_size', { mode: 'number' }).notNull(),
	s3Key: text('s3_key').notNull(),
	message: text('message'),
	// null = no password; format "scrypt:N:r:p:<salt b64>:<hash b64>"
	passwordHash: text('password_hash'),
	status: text('status', { enum: ['pending', 'ready'] })
		.notNull()
		.default('pending'),
	// null = never expires
	expiresAt: timestamp('expires_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	downloadCount: integer('download_count').notNull().default(0),
	verifyAttempts: integer('verify_attempts').notNull().default(0),
	verifyWindowStart: timestamp('verify_window_start', { withTimezone: true })
});

export type Transfer = typeof transfers.$inferSelect;
