<script lang="ts">
	import { File as FileIcon } from '@lucide/svelte';

	import { m } from '$lib/paraglide/messages.js';

	let fileInput: HTMLInputElement;
	let isDragging = false;
	let selectedFile: File | null = null;
	let uploading = false;

	function handleClick() {
		fileInput.click();
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			selectedFile = files[0];
			fileInput.files = files;
		}
	}

	function handleFileChange(e: Event) {
		const target = e.target as HTMLInputElement;
		const files = target.files;
		if (files && files.length > 0) {
			selectedFile = files[0];
		}
	}

	function fileSize(file: File): string {
		const sizeInBytes = file.size;
		const sizeInKB = sizeInBytes / 1024;
		const sizeInMB = sizeInKB / 1024;

		if (sizeInMB >= 1) {
			return `${sizeInMB.toFixed(2)} MB`;
		} else if (sizeInKB >= 1) {
			return `${sizeInKB.toFixed(2)} KB`;
		} else {
			return `${sizeInBytes} bytes`;
		}
	}
</script>

<form class="flex w-xl flex-col gap-4 rounded-2xl bg-white p-4">
	{#if uploading}
		<span>Uploading...</span>
	{:else}
		<div
			role="button"
			tabindex="0"
			onclick={handleClick}
			onkeydown={(e) => e.key === 'Enter' && handleClick()}
			ondragover={handleDragOver}
			ondragleave={handleDragLeave}
			ondrop={handleDrop}
			class="flex h-64 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-4 border-dotted border-blue-100 transition-colors {isDragging
				? 'border-blue-400 bg-blue-50'
				: 'hover:border-blue-300 hover:bg-blue-50/50'}"
		>
			<FileIcon class="text-blue-400" size="48" />
			<span class="text-gray-900">{selectedFile ? selectedFile.name : m.upload_file_cta()}</span>
			<span class="text-sm text-gray-500"
				>{selectedFile ? 'Size: ' + fileSize(selectedFile) : m.upload_file_hint()}</span
			>
			<input
				bind:this={fileInput}
				onchange={handleFileChange}
				class="hidden"
				type="file"
				name="file"
			/>
		</div>

		<!-- <div class="h-px w-full bg-blue-100"></div> -->

		<div class="flex w-full flex-col">
			<label class="text-sm" for="email">{m.upload_email_label()}</label>
			<input
				class="rounded border border-blue-100 px-2 py-1 text-base hover:border-blue-300 focus:border-blue-500"
				type="email"
				name="email"
				placeholder={m.upload_email_placeholder()}
			/>
		</div>

		<div class="flex w-full flex-col">
			<label class="text-sm" for="receiver">{m.upload_receiver_label()}</label>
			<input
				class="rounded border border-blue-100 px-2 py-1 text-base hover:border-blue-300 focus:border-blue-500"
				type="email"
				name="receiver"
				placeholder={m.upload_receiver_placeholder()}
			/>
		</div>

		<div class="flex w-full flex-col">
			<label class="text-sm" for="password">{m.upload_password_label()}</label>
			<input
				class="rounded border border-blue-100 px-2 py-1 text-base hover:border-blue-300 focus:border-blue-500"
				type="password"
				name="password"
				placeholder={m.upload_password_placeholder()}
			/>
		</div>

		<div class="flex w-full flex-row gap-4">
			<div class="flex w-full flex-3 flex-col">
				<label class="text-sm" for="expires_in">{m.upload_expiration_label()}</label>
				<select
					name="expires_in"
					class="rounded border border-blue-100 px-2 py-1.5 text-base hover:border-blue-300 focus:border-blue-500"
				>
					<option value="option-1d">{m.upload_expiration_option_1d()}</option>
					<option selected value="option-3d">{m.upload_expiration_option_3d()}</option>
					<option value="option-7d">{m.upload_expiration_option_7d()}</option>
					<option value="option-30d">{m.upload_expiration_option_30d()}</option>
					<option value="option-365d">{m.upload_expiration_option_365d()}</option>
					<option value="option-never">{m.upload_expiration_option_never()}</option>
				</select>
			</div>
			<div class="flex w-full flex-1 flex-col">
				<label class="text-sm" for="options">{m.upload_options_label()}</label>
				<button
					name="options"
					class="h-full rounded border border-blue-100 px-2 text-base hover:border-blue-300 focus:border-blue-500"
				>
					...
				</button>
			</div>
		</div>

		<button
			class="w-full rounded bg-blue-500 px-4 py-2 text-white"
			type="submit"
			onclick={handleUpload}
		>
			{m.upload_button_label()}
		</button>
	{/if}
</form>
