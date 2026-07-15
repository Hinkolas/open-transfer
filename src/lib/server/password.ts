import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

function deriveKey(password: string, salt: Buffer, N: number, r: number, p: number) {
	return new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, KEY_LENGTH, { N, r, p }, (err, key) =>
			err ? reject(err) : resolve(key)
		);
	});
}

export async function hashPassword(password: string): Promise<string> {
	const salt = randomBytes(16);
	const key = await deriveKey(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
	return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString('base64')}:${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const [scheme, n, r, p, saltB64, hashB64] = stored.split(':');
	if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
	const expected = Buffer.from(hashB64, 'base64');
	const key = await deriveKey(
		password,
		Buffer.from(saltB64, 'base64'),
		Number(n),
		Number(r),
		Number(p)
	);
	return key.length === expected.length && timingSafeEqual(key, expected);
}
