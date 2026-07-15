<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Stamp from '$lib/components/Stamp.svelte';
</script>

<svelte:head>
	<title>
		{page.status === 410 ? 'Transfer expired' : page.status === 404 ? 'Not found' : 'Error'} — OpenTransfer
	</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<section
	class="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-5 pt-10 pb-16 text-center sm:pt-16"
>
	{#if page.status === 410}
		<Stamp arc="OPENTRANSFER · RETURNED TO SENDER ·" center="EXPIRED" tone="wax" />
		<h1 class="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
			This transfer has expired.
		</h1>
		<p class="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
			The file was removed from storage on schedule. Ask the sender for a fresh link.
		</p>
	{:else if page.status === 404}
		<Stamp arc="OPENTRANSFER · NO SUCH ADDRESS ·" center="404" />
		<h1 class="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
			Nothing at this address.
		</h1>
		<p class="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
			The link may be mistyped, or the transfer was taken down.
		</p>
	{:else}
		<Stamp arc="OPENTRANSFER · UNDELIVERABLE ·" center={String(page.status)} tone="wax" />
		<h1 class="mt-6 font-display text-3xl font-bold tracking-tight sm:text-4xl">
			Something went wrong.
		</h1>
		<p class="mt-3 max-w-sm text-[0.9375rem] leading-relaxed text-ink-soft">
			{page.error?.message ?? 'An unexpected error occurred.'}
		</p>
	{/if}

	<a href={resolve('/')} class="btn-primary mt-8">Send a file</a>
</section>
