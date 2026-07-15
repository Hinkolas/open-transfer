export class UploadError extends Error {
	status?: number;
	constructor(message: string, status?: number) {
		super(message);
		this.name = 'UploadError';
		this.status = status;
	}
}

// XHR instead of fetch: fetch has no upload progress events.
// Content-Type is left to the browser (it sends the File's type) — the presigned
// URL deliberately signs no headers, so any value passes.
export function uploadFile(
	url: string,
	file: File,
	opts: { onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal } = {}
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', url);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) opts.onProgress?.(e.loaded, e.total);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) resolve();
			else reject(new UploadError(`Storage responded with status ${xhr.status}`, xhr.status));
		};
		xhr.onerror = () =>
			reject(new UploadError('Network error during upload — is the bucket CORS configured?'));
		xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
		opts.signal?.addEventListener('abort', () => xhr.abort());
		xhr.send(file);
	});
}
