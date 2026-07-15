<script lang="ts">
	import { FileUp, File as FileIcon, X } from '@lucide/svelte';
	import { formatBytes } from '$lib/format';
	import { MAX_FILE_SIZE } from '$lib/transfer';

	let {
		file = null,
		onselect
	}: {
		file?: File | null;
		onselect: (file: File | null) => void;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let dragging = $state(false);
	let sizeError = $state(false);

	function pick(list: FileList | null | undefined) {
		const picked = list?.[0];
		if (!picked) return;
		if (picked.size > MAX_FILE_SIZE) {
			sizeError = true;
			return;
		}
		sizeError = false;
		onselect(picked);
	}
</script>

{#if file}
	<div class="flex items-center gap-3 rounded-lg border border-line px-4 py-3.5">
		<div class="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-paper">
			<FileIcon class="h-5 w-5 text-ink-soft" aria-hidden="true" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="truncate font-mono text-sm font-medium">{file.name}</p>
			<p class="font-mono text-xs text-ink-soft">{formatBytes(file.size)}</p>
		</div>
		<button
			type="button"
			class="rounded-md p-2 text-ink-soft transition-colors hover:text-wax"
			onclick={() => onselect(null)}
			aria-label="Remove file"
		>
			<X class="h-4 w-4" />
		</button>
	</div>
{:else}
	<button
		type="button"
		class="w-full rounded-lg border border-dashed px-6 py-12 text-center transition-colors
			{dragging ? 'border-post bg-post/5' : 'border-line hover:border-ink-soft'}"
		onclick={() => input?.click()}
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={(e) => {
			e.preventDefault();
			dragging = false;
			pick(e.dataTransfer?.files);
		}}
	>
		<FileUp
			class="mx-auto h-7 w-7 text-ink-soft {dragging ? 'text-post' : ''}"
			aria-hidden="true"
		/>
		<p class="mt-3 text-sm font-medium">
			Drop a file here <span class="font-normal text-ink-soft">or click to browse</span>
		</p>
		<p class="mt-1.5 font-mono text-xs text-ink-soft">
			{#if sizeError}
				<span class="text-wax">That file is over the 3 GB limit.</span>
			{:else}
				One file, up to 3 GB. Zip a folder first.
			{/if}
		</p>
	</button>
{/if}

<input
	bind:this={input}
	type="file"
	class="hidden"
	onchange={(e) => {
		pick(e.currentTarget.files);
		e.currentTarget.value = '';
	}}
/>
