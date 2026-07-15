<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import Dropzone from '$lib/components/Dropzone.svelte';
	import TransferSuccess from '$lib/components/TransferSuccess.svelte';
	import UploadProgress from '$lib/components/UploadProgress.svelte';
	import { uploadFile } from '$lib/upload';
	import {
		DEFAULT_EXPIRY,
		EXPIRY_OPTIONS,
		MAX_FILE_SIZE,
		type ApiError,
		type CreateTransferResponse,
		type ExpiryOption,
		type FinalizeTransferResponse
	} from '$lib/transfer';

	type Phase = 'idle' | 'creating' | 'uploading' | 'finalizing' | 'success' | 'error';

	let phase = $state<Phase>('idle');
	let file = $state<File | null>(null);
	let message = $state('');
	let expiry = $state<ExpiryOption>(DEFAULT_EXPIRY);
	let password = $state('');
	let loaded = $state(0);
	let errorMessage = $state('');
	let shareUrl = $state('');
	let expiresAt = $state<Date | null>(null);
	let controller: AbortController | null = null;

	async function send(e: SubmitEvent) {
		e.preventDefault();
		if (!file || file.size > MAX_FILE_SIZE) return;

		phase = 'creating';
		loaded = 0;
		try {
			const created = await fetch('/api/transfers', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					fileName: file.name,
					fileSize: file.size,
					expiry,
					message: message.trim() || undefined,
					password: password || undefined
				})
			});
			if (!created.ok) throw new Error(((await created.json()) as ApiError).message);
			const { id, uploadUrl } = (await created.json()) as CreateTransferResponse;

			phase = 'uploading';
			controller = new AbortController();
			await uploadFile(uploadUrl, file, {
				onProgress: (l) => (loaded = l),
				signal: controller.signal
			});

			phase = 'finalizing';
			const finalized = await fetch(`/api/transfers/${id}/finalize`, { method: 'POST' });
			// 409 = already finalized (retry) — same success payload
			if (!finalized.ok && finalized.status !== 409) {
				throw new Error(((await finalized.json()) as ApiError).message);
			}
			const { url } = (await finalized.json()) as FinalizeTransferResponse;

			const seconds = EXPIRY_OPTIONS.find((o) => o.value === expiry)?.seconds ?? null;
			expiresAt = seconds === null ? null : new Date(Date.now() + seconds * 1000);
			shareUrl = new URL(url, location.origin).href;
			phase = 'success';
		} catch (err) {
			if (err instanceof DOMException && err.name === 'AbortError') {
				phase = 'idle';
				return;
			}
			errorMessage = err instanceof Error ? err.message : 'Something went wrong';
			phase = 'error';
		}
	}

	function reset() {
		phase = 'idle';
		file = null;
		message = '';
		password = '';
		expiry = DEFAULT_EXPIRY;
		loaded = 0;
		shareUrl = '';
		expiresAt = null;
	}
</script>

<svelte:head>
	<title>OpenTransfer — send a file, get a link</title>
</svelte:head>

<section class="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-16 sm:pt-14">
	<p class="eyebrow">Registered file post</p>
	<h1 class="mt-3 font-display text-4xl font-bold tracking-tight text-balance sm:text-5xl">
		Send it sealed.
	</h1>
	<p class="mt-3 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
		Files up to 3 GB, delivered by link. Optional password, expiry on your terms — then it's gone.
	</p>

	<div class="card rise-in mt-9 p-6 sm:p-8">
		{#if phase === 'success'}
			<TransferSuccess
				url={shareUrl}
				fileName={file?.name ?? ''}
				fileSize={file?.size ?? 0}
				{expiresAt}
				onreset={reset}
			/>
		{:else if phase === 'error'}
			<div class="text-center" role="alert">
				<div class="mx-auto grid h-12 w-12 place-items-center rounded-full bg-wax/10">
					<TriangleAlert class="h-6 w-6 text-wax" aria-hidden="true" />
				</div>
				<h2 class="mt-4 font-display text-xl font-bold">The upload didn't make it.</h2>
				<p class="mt-2 text-sm text-ink-soft">{errorMessage}</p>
				<button type="button" class="btn-primary mt-6" onclick={() => (phase = 'idle')}>
					Try again
				</button>
			</div>
		{:else if phase !== 'idle'}
			<UploadProgress
				fileName={file?.name ?? ''}
				{loaded}
				total={file?.size ?? 0}
				stage={phase}
				oncancel={() => controller?.abort()}
			/>
		{:else}
			<form onsubmit={send}>
				<Dropzone {file} onselect={(f) => (file = f)} />

				<div class="mt-5">
					<label class="field-label" for="message"
						>Message <span class="normal-case">— optional</span></label
					>
					<textarea
						id="message"
						class="field resize-none"
						rows="2"
						maxlength="4096"
						placeholder="Anything the recipient should know"
						bind:value={message}></textarea>
				</div>

				<div class="mt-4 grid gap-4 sm:grid-cols-2">
					<div>
						<label class="field-label" for="expiry">Expires</label>
						<select id="expiry" class="field" bind:value={expiry}>
							{#each EXPIRY_OPTIONS as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label class="field-label" for="password"
							>Password <span class="normal-case">— optional</span></label
						>
						<input
							id="password"
							type="password"
							class="field"
							autocomplete="new-password"
							maxlength="256"
							placeholder="None"
							bind:value={password}
						/>
					</div>
				</div>

				<button type="submit" class="btn-primary mt-7 w-full" disabled={!file}>
					Seal and send
				</button>
			</form>
		{/if}
	</div>
</section>
