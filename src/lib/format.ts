export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unit = -1;
	do {
		value /= 1024;
		unit++;
	} while (value >= 1024 && unit < units.length - 1);
	return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

export function formatTimeLeft(expiresAt: Date | string | null): string {
	if (!expiresAt) return 'Never expires';
	const ms = new Date(expiresAt).getTime() - Date.now();
	if (ms <= 0) return 'Expired';
	const minutes = Math.floor(ms / 60_000);
	if (minutes < 60) return `Expires in ${minutes <= 1 ? 'a minute' : `${minutes} minutes`}`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `Expires in ${hours === 1 ? 'an hour' : `${hours} hours`}`;
	const days = Math.round(hours / 24);
	return `Expires in ${days === 1 ? 'a day' : `${days} days`}`;
}
