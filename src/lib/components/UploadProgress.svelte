<script lang="ts">
	import { formatBytes } from '$lib/format';

	let {
		fileName,
		loaded,
		total,
		stage,
		oncancel
	}: {
		fileName: string;
		loaded: number;
		total: number;
		stage: 'creating' | 'uploading' | 'finalizing';
		oncancel: () => void;
	} = $props();

	const percent = $derived(total > 0 ? Math.min(100, Math.floor((loaded / total) * 100)) : 0);
	const indeterminate = $derived(stage !== 'uploading');
</script>

<div role="status" aria-live="polite">
	<p class="truncate font-mono text-sm font-medium">{fileName}</p>

	<div class="mt-4 h-3 overflow-hidden rounded-full border border-line bg-paper">
		<div
			class="airmail h-full rounded-full transition-[width] duration-200 ease-out {indeterminate
				? 'pulse-soft w-full'
				: ''}"
			style={indeterminate ? '' : `width: ${Math.max(2, percent)}%`}
		></div>
	</div>

	<div class="mt-2.5 flex items-baseline justify-between">
		<p class="font-mono text-xs text-ink-soft">
			{#if stage === 'creating'}
				Preparing transfer…
			{:else if stage === 'finalizing'}
				Verifying upload…
			{:else}
				{formatBytes(loaded)} of {formatBytes(total)}
			{/if}
		</p>
		{#if stage === 'uploading'}
			<p class="font-mono text-sm font-medium">{percent}%</p>
		{/if}
	</div>

	<button
		type="button"
		class="btn-secondary mt-6 w-full"
		onclick={oncancel}
		disabled={stage === 'finalizing'}
	>
		Cancel upload
	</button>
</div>
