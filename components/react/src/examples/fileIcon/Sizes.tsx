import FileIcon from "../../../lib/components/files/fileIcon/FileIcon";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SIZES = [16, 24, 32, 48, 64, 96];

const Example = () => {
    useExampleState({ sizes: SIZES });

    return (
        <div className={`flex flex-wrap items-end gap-6`}>
            {SIZES.map((size) => (
                <div key={size} className={`flex flex-col items-center gap-2`}>
                    <FileIcon fileName={`app.ts`} size={size} />
                    <span className={`text-xs text-muted-foreground`}>{size}px</span>
                </div>
            ))}
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.fileIcon.sizes,
    Example
};

export default module;
