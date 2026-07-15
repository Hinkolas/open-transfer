<script lang="ts">
	let {
		arc,
		center,
		tone = 'ink',
		animate = false
	}: {
		arc: string;
		center: string;
		tone?: 'ink' | 'wax';
		animate?: boolean;
	} = $props();

	const uid = $props.id();
</script>

<svg
	viewBox="0 0 120 120"
	class="h-28 w-28 {tone === 'wax' ? 'text-wax' : 'text-ink'} {animate ? 'stamp-in' : '-rotate-6'}"
	role="img"
	aria-label="{center} postmark"
>
	<circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" stroke-width="2.5" />
	<circle cx="60" cy="60" r="43" fill="none" stroke="currentColor" stroke-width="1.25" />
	<path id="stamp-arc-{uid}" d="M 60 12.5 A 47.5 47.5 0 1 1 59.9 12.5" fill="none" />
	<text
		font-size="9"
		font-weight="500"
		letter-spacing="2.6"
		fill="currentColor"
		style="font-family: var(--font-mono)"
	>
		<textPath href="#stamp-arc-{uid}">{arc}</textPath>
	</text>
	<text
		x="60"
		y="58"
		text-anchor="middle"
		font-size="11"
		font-weight="500"
		letter-spacing="1.5"
		fill="currentColor"
		style="font-family: var(--font-mono)"
	>
		{center}
	</text>
	<path
		d="M32 70 q7 -3.5 14 0 t14 0 t14 0 t14 0"
		fill="none"
		stroke="currentColor"
		stroke-width="1.4"
		stroke-linecap="round"
	/>
	<path
		d="M38 78 q7 -3.5 14 0 t14 0 t14 0"
		fill="none"
		stroke="currentColor"
		stroke-width="1.4"
		stroke-linecap="round"
	/>
</svg>
