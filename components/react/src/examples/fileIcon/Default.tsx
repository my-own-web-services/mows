import FileIcon from "../../../lib/components/files/fileIcon/FileIcon";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const FILES = [
    `app.ts`,
    `app.tsx`,
    `styles.css`,
    `README.md`,
    `package.json`,
    `Dockerfile`,
    `.gitignore`,
    `photo.png`,
    `archive.zip`,
    `notes.pdf`
];

const Example = () => {
    useExampleState({ count: FILES.length });

    return (
        <div className={`flex flex-wrap gap-4`}>
            {FILES.map((fileName) => (
                <div
                    key={fileName}
                    className={`flex w-24 flex-col items-center gap-2 rounded-md border p-3`}
                >
                    <FileIcon fileName={fileName} size={32} />
                    <span className={`text-xs text-muted-foreground`}>{fileName}</span>
                </div>
            ))}
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.fileIcon.default,
    Example
};

export default module;
