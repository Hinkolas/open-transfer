<script lang="ts">
	import { Check, Copy, ExternalLink } from '@lucide/svelte';
	import Stamp from '$lib/components/Stamp.svelte';
	import { formatBytes, formatTimeLeft } from '$lib/format';

	let {
		url,
		fileName,
		fileSize,
		expiresAt,
		onreset
	}: {
		url: string;
		fileName: string;
		fileSize: number;
		expiresAt: Date | null;
		onreset: () => void;
	} = $props();

	let copied = $state(false);
	let copyTimeout: ReturnType<typeof setTimeout>;

	const stampDate = new Date()
		.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
		.toUpperCase();

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
		clearTimeout(copyTimeout);
		copyTimeout = setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="text-center" role="status" aria-live="polite">
	<div class="flex justify-center">
		<Stamp arc="OPENTRANSFER · REGISTERED · OPENTRANSFER ·" center={stampDate} animate />
	</div>

	<h2 class="mt-5 font-display text-2xl font-bold tracking-tight">Sealed and ready.</h2>
	<p class="mt-2 font-mono text-xs text-ink-soft">
		{fileName} · {formatBytes(fileSize)} · {formatTimeLeft(expiresAt)}
	</p>

	<!-- tear-off claim ticket -->
	<div class="relative mt-7 rounded-lg border border-dashed border-line bg-paper/60">
		<div
			class="absolute top-1/2 -left-2.5 h-5 w-5 -translate-y-1/2 rounded-full border-r border-line bg-card"
			aria-hidden="true"
		></div>
		<div
			class="absolute top-1/2 -right-2.5 h-5 w-5 -translate-y-1/2 rounded-full border-l border-line bg-card"
			aria-hidden="true"
		></div>
		<div class="flex items-center gap-2 py-3 pr-3 pl-5">
			<p class="min-w-0 flex-1 truncate text-left font-mono text-sm">{url}</p>
			<button type="button" class="btn-primary shrink-0 !px-3.5 !py-2 !text-sm" onclick={copy}>
				{#if copied}
					<Check class="h-4 w-4" /> Copied
				{:else}
					<Copy class="h-4 w-4" /> Copy link
				{/if}
			</button>
		</div>
	</div>

	<div class="mt-6 flex items-center justify-center gap-3">
		<!-- runtime-absolute share URL, not a route the linter can resolve -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href={url} target="_blank" rel="noopener noreferrer" class="btn-secondary">
			<ExternalLink class="h-4 w-4" /> Open link
		</a>
		<button
			type="button"
			class="px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
			onclick={onreset}
		>
			Send another file
		</button>
	</div>
</div>
