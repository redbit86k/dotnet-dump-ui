<script lang="ts">
  import CoredumpInfoObject from "../lib/CoredumpInfoObject.svelte";
  import {
    dump,
    type CoreDumpObject,
    type CoreDumpInfo,
  } from "../lib/dotnet-dump";

  let dumpPath = $state("");
  let errorMsg = $state("");
  let heapStat = $state<CoreDumpInfo<CoreDumpObject>>({});

  const dumpHeapStats = async () => {
    const { dumpHeapStat } = dump(dumpPath);
    let result = await dumpHeapStat();
    heapStat = result.result;
    errorMsg = result.error;
  };
</script>

<main class="container">
  <h1>dotnet-dump-ui</h1>

  <input
    id="greet-input"
    placeholder="Enter a path to a dump file"
    bind:value={dumpPath}
  />
  <p>{errorMsg}</p>

  <button onclick={dumpHeapStats}>Dump Heap Stats</button>
  <h2>Heap Stats</h2>
  <div>
    {#each (heapStat?.objects ?? []).slice(0, 100) as obj}
      <CoredumpInfoObject {obj} {dumpPath} />
    {/each}
  </div>
</main>

<style>
  .container {
    margin: 0;

    display: flex;
    flex-direction: column;
    justify-content: center;
    text-align: left;
  }
</style>
