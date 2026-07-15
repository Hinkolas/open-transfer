import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';

// 6 h so a 3 GB upload on a slow link doesn't outlive its URL
const UPLOAD_URL_TTL = 6 * 60 * 60;
export const DOWNLOAD_URL_TTL = 300;

let client: S3Client | undefined;

function s3(): S3Client {
	if (!client) {
		if (!env.S3_BUCKET) throw new Error('S3_BUCKET is not set');
		client = new S3Client({
			endpoint: env.S3_ENDPOINT || undefined,
			region: env.S3_REGION || 'us-east-1',
			forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY_ID ?? '',
				secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? ''
			}
		});
	}
	return client;
}

// No ContentType/ContentLength on the command: signed headers would have to match the
// browser's request byte-for-byte across S3-compatible providers. Size is enforced at
// finalize via headObject instead.
export function createUploadUrl(key: string): Promise<string> {
	return getSignedUrl(s3(), new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
		expiresIn: UPLOAD_URL_TTL
	});
}

export function createDownloadUrl(key: string, fileName: string): Promise<string> {
	return getSignedUrl(
		s3(),
		new GetObjectCommand({
			Bucket: env.S3_BUCKET,
			Key: key,
			ResponseContentDisposition: contentDisposition(fileName)
		}),
		{ expiresIn: DOWNLOAD_URL_TTL }
	);
}

export async function headObject(key: string): Promise<{ contentLength: number } | null> {
	try {
		const res = await s3().send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
		return { contentLength: res.ContentLength ?? 0 };
	} catch (err) {
		if (isNotFound(err)) return null;
		throw err;
	}
}

export async function deleteObject(key: string): Promise<void> {
	try {
		await s3().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
	} catch (err) {
		console.error(`failed to delete s3 object ${key}`, err);
	}
}

function isNotFound(err: unknown): boolean {
	if (typeof err !== 'object' || err === null) return false;
	const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
	return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
}

// RFC 6266/5987: ASCII fallback in filename, full UTF-8 name in filename*
function contentDisposition(fileName: string): string {
	const fallback = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
	const encoded = encodeURIComponent(fileName).replace(
		/['()*]/g,
		(c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
	);
	return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
