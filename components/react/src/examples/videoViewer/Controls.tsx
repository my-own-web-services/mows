import { useState } from "react";
import VideoViewer from "../../../lib/components/files/fileViewer/formats/videoViewer/VideoViewer";
import { Button } from "../../../lib/components/ui/button";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SOURCES = [
    {
        id: `mp4`,
        label: `MP4 (progressive)`,
        src: `https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-only/v-0480p-1000k-libx264.mp4`,
        mime: `video/mp4`
    },
    {
        id: `dash`,
        label: `DASH (adaptive)`,
        src: `https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd`,
        mime: `application/dash+xml`
    },
    {
        id: `hls`,
        label: `HLS (adaptive)`,
        src: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`,
        mime: `application/vnd.apple.mpegurl`
    }
] as const;

const Example = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const active = SOURCES[activeIndex];
    useExampleState({ activeSource: active.id, mimeType: active.mime });
    return (
        <div className={`flex flex-col gap-3`}>
            <div className={`flex flex-wrap gap-2`}>
                {SOURCES.map((source, i) => (
                    <Button
                        key={source.id}
                        size={`sm`}
                        variant={i === activeIndex ? `default` : `outline`}
                        onClick={() => setActiveIndex(i)}
                    >
                        {source.label}
                    </Button>
                ))}
            </div>
            <div className={`aspect-video w-full max-w-3xl overflow-hidden rounded-md border`}>
                <VideoViewer
                    key={active.id}
                    src={active.src}
                    mimeType={active.mime}
                    name={active.label}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.videoViewer.controls,
    Example
};

export default module;
