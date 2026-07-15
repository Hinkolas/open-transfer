<script lang="ts">
	import { resolve } from '$app/paths';
	import { Download } from '@lucide/svelte';
	import PasswordGate from '$lib/components/PasswordGate.svelte';
	import TransferCard from '$lib/components/TransferCard.svelte';
	import { formatBytes } from '$lib/format';
	import type { ApiError, DownloadResponse } from '$lib/transfer';

	let { data } = $props();

	let busy = $state(false);
	let gateError = $state('');
	let started = $state(false);

	async function download(password?: string) {
		busy = true;
		gateError = '';
		try {
			const res = await fetch(`/api/transfers/${data.id}/download`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			const body = (await res.json()) as DownloadResponse & ApiError;
			if (!res.ok) {
				if (res.status === 429 && body.retryAfterSeconds) {
					const minutes = Math.max(1, Math.ceil(body.retryAfterSeconds / 60));
					gateError = `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
				} else if (res.status === 403 && body.attemptsRemaining !== undefined) {
					gateError = `${body.message} — ${body.attemptsRemaining} attempt${body.attemptsRemaining === 1 ? '' : 's'} left.`;
				} else {
					gateError = body.message;
				}
				return;
			}
			started = true;
			window.location.href = body.downloadUrl;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{data.fileName} — OpenTransfer</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section class="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-16 sm:pt-14">
	<p class="eyebrow">Delivery for you</p>
	<h1 class="mt-3 font-display text-4xl font-bold tracking-tight sm:text-5xl">A file for you.</h1>
	<p class="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
		Someone sent you a file with OpenTransfer. Check it, then take it — the link won't last forever.
	</p>

	<div class="mt-9">
		<TransferCard
			fileName={data.fileName}
			fileSize={data.fileSize}
			message={data.message}
			expiresAt={data.expiresAt}
		>
			{#if data.requiresPassword && !started}
				<PasswordGate {busy} error={gateError} onsubmit={download} />
			{:else if !started}
				<button type="button" class="btn-primary w-full" disabled={busy} onclick={() => download()}>
					<Download class="h-4 w-4" aria-hidden="true" />
					{busy ? 'Preparing…' : `Download · ${formatBytes(data.fileSize)}`}
				</button>
				{#if gateError}
					<p class="mt-2.5 text-center font-mono text-xs text-wax" role="alert">{gateError}</p>
				{/if}
			{:else}
				<div class="text-center" role="status">
					<p class="text-sm font-medium">Your download has started.</p>
					<p class="mt-1.5 font-mono text-xs text-ink-soft">
						Nothing happened? <button
							type="button"
							class="underline underline-offset-2 hover:text-ink"
							onclick={() => (started = false)}>Try again</button
						>
					</p>
				</div>
			{/if}
		</TransferCard>
	</div>

	<p class="mt-7 text-center">
		<a
			href={resolve('/')}
			class="text-sm font-medium text-ink-soft transition-colors hover:text-ink"
		>
			Send your own file →
		</a>
	</p>
</section>
