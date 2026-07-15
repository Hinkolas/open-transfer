export const MAX_FILE_SIZE = 3 * 1024 ** 3; // 3 GiB — under S3's 5 GB single-PUT limit

export const EXPIRY_OPTIONS = [
	{ value: '1d', label: '1 day', seconds: 86_400 },
	{ value: '3d', label: '3 days', seconds: 259_200 },
	{ value: '7d', label: '7 days', seconds: 604_800 },
	{ value: '30d', label: '30 days', seconds: 2_592_000 },
	{ value: 'never', label: 'Never', seconds: null }
] as const;

export type ExpiryOption = (typeof EXPIRY_OPTIONS)[number]['value'];
export const DEFAULT_EXPIRY: ExpiryOption = '3d';

export interface CreateTransferRequest {
	fileName: string;
	fileSize: number;
	expiry: ExpiryOption;
	message?: string;
	password?: string;
}

export interface CreateTransferResponse {
	id: string;
	uploadUrl: string;
}

export interface FinalizeTransferResponse {
	id: string;
	url: string;
}

export interface DownloadRequest {
	password?: string;
}

export interface DownloadResponse {
	downloadUrl: string;
	expiresIn: number;
}

export interface ApiError {
	message: string;
	attemptsRemaining?: number;
	retryAfterSeconds?: number;
}
