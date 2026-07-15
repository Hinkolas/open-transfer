<script lang="ts">
	import { File as FileIcon } from '@lucide/svelte';
	import { formatBytes, formatTimeLeft } from '$lib/format';
	import type { Snippet } from 'svelte';

	let {
		fileName,
		fileSize,
		message,
		expiresAt,
		children
	}: {
		fileName: string;
		fileSize: number;
		message: string | null;
		expiresAt: string | null;
		children: Snippet;
	} = $props();
</script>

<div class="card rise-in p-6 sm:p-8">
	<div class="flex items-start gap-4">
		<div class="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-line bg-paper">
			<FileIcon class="h-6 w-6 text-ink-soft" aria-hidden="true" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="font-mono text-sm font-medium break-all">{fileName}</p>
			<p class="mt-1 font-mono text-xs text-ink-soft">
				{formatBytes(fileSize)} · {formatTimeLeft(expiresAt)}
			</p>
		</div>
	</div>

	{#if message}
		<div class="mt-6 border-t border-line pt-5">
			<p class="field-label">Message from the sender</p>
			<p class="text-[0.9375rem] leading-relaxed whitespace-pre-line">{message}</p>
		</div>
	{/if}

	<div class="mt-6 border-t border-line pt-6">
		{@render children()}
	</div>
</div>
