<script lang="ts">
	import CoredumpInfoTypeObject from "./CoredumpInfoTypeObject.svelte";
	import {
		dump,
		type CoreDumpInfo,
		type CoreDumpObject,
		type CoreDumpTypeObject,
	} from "./dotnet-dump";
	import prettyBytes from "pretty-bytes";
	let { obj, dumpPath }: { obj: CoreDumpObject; dumpPath: string } = $props();

	let heapStatType = $state<CoreDumpInfo<CoreDumpTypeObject>>({});
	let expanded = $state(false);
	let loading = $state(false);

	const { dumpHeapStatType } = dump(dumpPath);

	const dumpHeapStats = async () => {
		if (!expanded) {
			loading = true;
			const { dumpHeapStat } = dump(dumpPath);
			let result = await dumpHeapStatType(obj.type!);
			heapStatType = result.result;
			expanded = !expanded;
			loading = false;
		}
	};
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<details onclick={dumpHeapStats}>
	<summary>
		<div>
			<h3>
				<strong>{obj.type}</strong>
				<small>{obj.mt}</small>
			</h3>
			{#if loading}
				<span class="spinner"></span>
			{/if}
			<span>
				<strong>{prettyBytes(obj.totalSize)}</strong>
				<small> {obj.count}x </small>
			</span>
		</div>
	</summary>
	{#each (heapStatType?.objects ?? []).slice(1, 100) as typeObj}
		<CoredumpInfoTypeObject obj={typeObj} {dumpPath} />
	{/each}
</details>

<style>
	.spinner {
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 50%;
		border: 2px solid #729628;
		border-top-color: transparent;
		margin-left: auto;
		margin-right: 0.5em;
		animation: spin 0.5s linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	summary {
		background-color: #eeeeee;
		position: relative;
		cursor: pointer;
		list-style: none;
		&::-webkit-details-marker {
			display: none;
		}

		&:hover {
			background-color: #f2f5f9;
		}

		div {
			display: flex;
			align-items: center;
		}

		h3 {
			padding: 0.5em;
			flex-direction: column;
		}

		small {
			color: #999;
			font-size: 0.875em;
		}

		strong {
			font-weight: 700;
		}

		span:first-child {
			width: 4rem;
			height: 4rem;
			border-radius: 10px;
			background-color: #f3e1e1;
			display: flex;
			flex-shrink: 0;
			align-items: center;
			justify-content: center;
			margin-right: 1.25em;
			svg {
				width: 2.25rem;
				height: 2.25rem;
			}
		}

		span:last-child {
			font-weight: 700;
			margin-left: auto;
		}

		&:focus {
			outline: none;
		}

		.plus {
			color: #289672;
		}
	}

	details {
		padding-left: 1em;
		border-bottom: 1px solid #b5bfd9;
		&[open] {
			box-shadow: -3px 0 0 #b5bfd9;
		}

		&:first-of-type {
			border-top: 1px solid #b5bfd9;
		}
		& > div {
			padding: 2em 2em 0;
			font-size: 0.875em;
		}
	}
</style>
