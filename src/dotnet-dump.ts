
import { Command } from "@tauri-apps/plugin-shell";


const execute = async (dumpPath: string, command: string) => {
    let result = await Command.create("exec-sh", [
        "-c",
        `export DOTNET_ROOT=/home/red/.dotnet;dotnet-dump analyze ${dumpPath} -c ${command} exit`,
    ]).execute();
    console.log(result);

    return result;
};


export interface CoreDumpInfo {
  core_dump_path?: string;
  objects?: CoreDumpObject[];
  total_objects?: number;
  total_bytes?: number;}

export interface CoreDumpObject {
  address: string;
  count: string;
  totalSize: number;
  type?: string;
}

export interface CoreDumpResult<T> {
    error?: string;
    result?:T;
}

function parseCoreDumpOutput(output: string): CoreDumpInfo {
  const result: CoreDumpInfo = {};

  // 1. Extract core dump path
  const coreDumpMatch = output.match(/Loading core dump: (.*?) \.\.\./);
  if (coreDumpMatch) {
    result.core_dump_path = coreDumpMatch[1].trim();
  }

  // 2. Extract object details
  const objects: CoreDumpObject[] = [];
  const objectMatches = output.matchAll(/( *)([0-9a-f]+) +([0-9a-f]+|[\d]+) +([\d,]+) ?(.*)?/g);

  for (const match of objectMatches) {
    if (match[2] === "Address") {
      continue;
    }

    const obj: CoreDumpObject = {
      address: match[2].trim(),
      count: match[3].trim(),
      totalSize: parseInt(match[4].replace(/,/g, ""), 10), // Remove commas from size and parse as integer
    };

    if (match[5] && match[5].trim() !== "") {
      obj.type = match[5].trim();
    }

    objects.push(obj);
  }
  result.objects = objects.reverse();

  // 3. Extract totals
  const totalsMatch = output.match(/Total ([\d,]+) objects, ([\d,]+) bytes/);
  if (totalsMatch) {
    result.total_objects = parseInt(totalsMatch[1].replace(/,/g, ""), 10);
    result.total_bytes = parseInt(totalsMatch[2].replace(/,/g, ""), 10);
  }


  return result;
}

// Example usage (assuming you have the output in a variable called 'outputString')
// const outputString = `Loading core dump: /home/red/dev/dosaic/example/src/Dosaic.Example.Service/core_20250404_205206 ...
//          Address               MT           Size
//     7a16e4000028     7a5703b92278          8,184
//     7a16e4002020     7a5703b92278         16,344
//     7a57080838c0   138 19,895,184 OpenTelemetry.Metrics.MetricPoint[]
// Total 48,980 objects, 25,729,680 bytes
// Unrecognized SOS command '-stat'`;

// const parsedData = parseCoreDumpOutput(outputString);
// console.log(JSON.stringify(parsedData, null, 2));


export const dump = (dumpPath: string) => ({
    execute: async (command: string) => await execute(dumpPath, command),
    dumpHeapStat: async () => {
        const data =  await execute(dumpPath, "dumpheap -stat")

        return {
            error: data.stderr,
            result: parseCoreDumpOutput(data.stdout),
        }
    },
})