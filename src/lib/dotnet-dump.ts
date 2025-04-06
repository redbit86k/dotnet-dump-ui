
import { Command } from "@tauri-apps/plugin-shell";


const execute = async (dumpPath: string, command: string) => {
    const cmd = `export DOTNET_ROOT=/home/red/.dotnet;dotnet-dump analyze ${dumpPath} -c "${command}" exit`;
    console.log("Executing command:", cmd);
    let result = await Command.create("exec-sh", [
        "-c",
        cmd,
    ]).execute();
    console.log(result.stdout.length, result);

    return result;
};


export interface CoreDumpInfo<T> {
    core_dump_path?: string;
    objects?: T[];
    total_objects?: number;
    total_bytes?: number;
}

export interface CoreDumpObject {
    mt: string;
    count: string;
    totalSize: number;
    type?: string;
}

export interface CoreDumpTypeObject {
    address: string;
    mt: string;
    size: number;
}

export interface CoreDumpResult<T> {
    error?: string;
    result?: T;
}

function parseDumpHeapStatOutput(output: string): CoreDumpInfo<CoreDumpObject> {
    const result: CoreDumpInfo<CoreDumpObject> = {};

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
            mt: match[2].trim(),
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


function parseDumpHeapStatTypeOutput(output: string): CoreDumpInfo<CoreDumpTypeObject> {
    const result: CoreDumpInfo<CoreDumpTypeObject> = {};

    // 1. Extract core dump path
    const coreDumpMatch = output.match(/Loading core dump: (.*?) \.\.\./);
    if (coreDumpMatch) {
        result.core_dump_path = coreDumpMatch[1].trim();
    }

    // 2. Extract object details
    const objects: CoreDumpTypeObject[] = [];
    const objectMatches = output.matchAll(/( *)([0-9a-f]+) +([0-9a-f]+|[\d]+) +([\d,]+)/g);

    for (const match of objectMatches) {
        if (match[2] === "Address") {
            continue;
        }

        const obj: CoreDumpTypeObject = {
            address: match[2].trim(),
            mt: match[3].trim(),
            size: parseInt(match[4].replace(/,/g, ""), 10), // Remove commas from size and parse as integer
        };



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

export const dump = (dumpPath: string) => ({
    execute: async (command: string) => await execute(dumpPath, command),
    dumpHeapStat: async () => {
        const data = await execute(dumpPath, "dumpheap -stat")
        return {
            error: data.stderr,
            result: parseDumpHeapStatOutput(data.stdout),
        }
    },
    dumpHeapStatType: async (type: string) => {
        const data = await execute(dumpPath, `dumpheap -type ${type}`)
        return {
            error: data.stderr,
            result: parseDumpHeapStatTypeOutput(data.stdout),
        }
    },
    gcroot: async (address: string) => {
        const data = await execute(dumpPath, `gcroot ${address}`)
        return {
            error: data.stderr,
            result: parseGcRootOutput(data.stdout),
        }
    }
})


export interface GcRootInfo {
    core_dump_path?: string;
    threads: GcRootThread[];
    unique_roots_count?: number;
}

export interface GcRootThread {
    id: string;
    frames: GcRootFrame[];
}

export interface GcRootFrame {
    address: string;
    methodAddress: string;
    method: string;
    sourceInfo?: string;
    references: GcRootReference[];
}

export interface GcRootReference {
    register: string;
    paths: GcRootPath[];
}

export interface GcRootPath {
    address: string;
    type: string;
}

function parseGcRootOutput(stdout: string): GcRootInfo {
    const result: GcRootInfo = {
        threads: []
    };

    // Extract core dump path
    const coreDumpMatch = stdout.match(/Loading core dump: (.*?) \.\.\./);
    if (coreDumpMatch) {
        result.core_dump_path = coreDumpMatch[1].trim();
    }

    // Extract unique roots count
    const uniqueRootsMatch = stdout.match(/Found (\d+) unique roots\./);
    if (uniqueRootsMatch) {
        result.unique_roots_count = parseInt(uniqueRootsMatch[1], 10);
    }

    // Split output by thread sections
    const threadSections = stdout.split(/Thread \w+:/);
    if (threadSections.length <= 1) {
        return result;
    }

    // Extract thread IDs
    const threadIds = stdout.match(/Thread (\w+):/g)?.map(id => id.replace(/Thread (\w+):/, '$1')) || [];
    
    // Process each thread section (skip the first which is content before any thread)
    for (let i = 0; i < threadIds.length; i++) {
        const threadId = threadIds[i];
        const sectionContent = threadSections[i + 1]; // +1 because first section is before any thread
        
        const thread: GcRootThread = {
            id: threadId,
            frames: []
        };
        
        // Split the section into frames
        const frameLines = sectionContent.trim().split('\n');
        let currentFrame: GcRootFrame | null = null;
        let currentReference: GcRootReference | null = null;
        
        for (const line of frameLines) {
            // Skip empty lines
            if (!line.trim()) continue;
            
            // Check if this is a new frame
            const frameMatch = line.match(/^\s{4}([0-9a-f]+) ([0-9a-f]+) (.*?)(\s+\[(.*?)\])?$/);
            if (frameMatch) {
                // Start a new frame
                currentFrame = {
                    address: frameMatch[1],
                    methodAddress: frameMatch[2],
                    method: frameMatch[3].trim(),
                    sourceInfo: frameMatch[5],
                    references: []
                };
                thread.frames.push(currentFrame);
                currentReference = null;
                continue;
            }
            
            // Check if this is a new reference
            if (currentFrame) {
                const referenceMatch = line.match(/^\s{8}([^:]+):/);
                if (referenceMatch) {
                    currentReference = {
                        register: referenceMatch[1].trim(),
                        paths: []
                    };
                    currentFrame.references.push(currentReference);
                    
                    // Check if there's also a path on this line
                    const pathMatch = line.match(/->.*?([0-9a-f]+)\s+(.*)/);
                    if (pathMatch && currentReference) {
                        currentReference.paths.push({
                            address: pathMatch[1],
                            type: pathMatch[2].trim()
                        });
                    }
                    continue;
                }
                
                // Check if this is a path (continuation)
                const pathMatch = line.match(/\s*->\s+([0-9a-f]+)\s+(.*)/);
                if (pathMatch && currentReference) {
                    currentReference.paths.push({
                        address: pathMatch[1],
                        type: pathMatch[2].trim()
                    });
                    continue;
                }
            }
        }
        
        result.threads.push(thread);
    }
    
    return result;
}

