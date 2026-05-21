import FileIcon from "../../../lib/components/files/fileIcon/FileIcon";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const UNKNOWN_FILES = [`thing.unknownext`, `noext`, `weirdfile.zzz`];

const Example = () => {
    useExampleState({ unknown: UNKNOWN_FILES });

    return (
        <div className={`flex flex-wrap gap-4`}>
            {UNKNOWN_FILES.map((fileName) => (
                <div
                    key={fileName}
                    className={`flex w-32 flex-col items-center gap-2 rounded-md border p-3`}
                >
                    <FileIcon fileName={fileName} size={32} />
                    <span className={`text-xs text-muted-foreground`}>{fileName}</span>
                </div>
            ))}
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.fileIcon.fallback,
    Example
};

export default module;
