import { useState } from "react";
import FileViewer from "../../../lib/components/files/fileViewer/FileViewer";
import { Button } from "../../../lib/components/ui/button";
import { Input } from "../../../lib/components/ui/input";
import sampleLandscapeUrl from "../../assets/samples/landscape-2000.webp";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [url, setUrl] = useState(sampleLandscapeUrl);
    const [name, setName] = useState(`hexlerz-231-2000.webp`);
    const [mimeType, setMimeType] = useState(`image/webp`);
    useExampleState({ url, name, mimeType });

    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`flex flex-wrap items-center gap-2`}>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} className={`max-w-sm`} />
                <Input value={name} onChange={(e) => setName(e.target.value)} className={`max-w-xs`} />
                <Input value={mimeType} onChange={(e) => setMimeType(e.target.value)} className={`max-w-xs`} />
                <Button
                    size={`sm`}
                    variant={`outline`}
                    onClick={() => {
                        setUrl(sampleLandscapeUrl);
                        setName(`hexlerz-231-2000.webp`);
                        setMimeType(`image/webp`);
                    }}
                >
                    Reset
                </Button>
            </div>
            <div className={`aspect-video w-full max-w-2xl rounded-md border bg-background`}>
                <FileViewer src={url} name={name} mimeType={mimeType} />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.fileViewer.default,
    Example
};

export default module;
