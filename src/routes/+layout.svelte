<script lang="ts">
	import './layout.css';
	import { resolve } from '$app/paths';
	import '@fontsource-variable/bricolage-grotesque/index.css';
	import '@fontsource-variable/public-sans/index.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<meta name="theme-color" content="#f1f2ef" />
</svelte:head>

<div class="flex min-h-svh flex-col">
	<div class="airmail h-1.5 shrink-0" aria-hidden="true"></div>

	<header class="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
		<a href={resolve('/')} class="flex items-center gap-2.5">
			<img src={favicon} alt="" class="h-6 w-6" />
			<span class="font-display text-lg font-bold tracking-tight">OpenTransfer</span>
		</a>
		<a
			href="https://github.com/hinkolas/open-transfer"
			target="_blank"
			rel="noopener noreferrer"
			class="font-mono text-[11px] font-medium tracking-[0.16em] text-ink-soft hover:text-ink"
		>
			SOURCE ↗
		</a>
	</header>

	<main class="flex w-full flex-1 flex-col">
		{@render children()}
	</main>

	<footer class="px-5 py-8 text-center">
		<p class="font-mono text-[11px] tracking-[0.16em] text-ink-soft uppercase">
			OpenTransfer · a self-hosted file courier
		</p>
	</footer>
</div>
