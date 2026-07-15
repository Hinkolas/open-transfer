<script lang="ts">
	import { LockKeyhole } from '@lucide/svelte';

	let {
		busy,
		error,
		onsubmit
	}: {
		busy: boolean;
		error: string;
		onsubmit: (password: string) => void;
	} = $props();

	let password = $state('');
</script>

<form
	onsubmit={(e) => {
		e.preventDefault();
		if (password) onsubmit(password);
	}}
>
	<label class="field-label" for="transfer-password">
		<LockKeyhole class="-mt-0.5 mr-1 inline h-3 w-3" aria-hidden="true" />
		This transfer is locked
	</label>
	<div class="flex gap-2.5">
		<input
			id="transfer-password"
			type="password"
			class="field flex-1"
			placeholder="Enter the password"
			autocomplete="off"
			bind:value={password}
			disabled={busy}
		/>
		<button type="submit" class="btn-primary shrink-0 !py-2" disabled={busy || !password}>
			{busy ? 'Checking…' : 'Unlock and download'}
		</button>
	</div>
	{#if error}
		<p class="mt-2.5 font-mono text-xs text-wax" role="alert">{error}</p>
	{/if}
</form>
