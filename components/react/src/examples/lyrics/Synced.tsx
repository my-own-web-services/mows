import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import Lyrics from "../../../lib/components/files/lyrics/Lyrics";
import { Button } from "../../../lib/components/ui/button";
import { MowsContext } from "../../../lib/lib/mowsContext/MowsContext";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE_LRC = `[ti:Travel Light]
[ar:MOWS Demo Choir]
[00:00.00]We packed the morning into a single bag
[00:04.20]Counted every footstep across the bridge
[00:08.80]Roads we'd never seen sang us their name
[00:13.30]A wind picked up and held us in the light
[00:18.00]Hold steady, breathe slow, the river keeps going
[00:22.40]Hold steady, breathe slow, the river keeps going
[00:27.10]We'll find a quiet place by morning
[00:31.80]Where the world remembers our name`;

const AUDIO_SRC = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3`;

const Example = () => {
    const mows = useContext(MowsContext);
    const t = mows?.t.example.examples.lyrics.syncedDemo;
    const audioRef = useRef<HTMLAudioElement>(null);
    const [time, setTime] = useState<number>(0);
    const [playing, setPlaying] = useState<boolean>(false);
    useExampleState({ playing, currentTime: time });

    useEffect(() => {
        const el = audioRef.current;
        if (!el) return;
        const onTime = (): void => setTime(el.currentTime);
        const onPlay = (): void => setPlaying(true);
        const onPause = (): void => setPlaying(false);
        el.addEventListener(`timeupdate`, onTime);
        el.addEventListener(`play`, onPlay);
        el.addEventListener(`pause`, onPause);
        return () => {
            el.removeEventListener(`timeupdate`, onTime);
            el.removeEventListener(`play`, onPlay);
            el.removeEventListener(`pause`, onPause);
        };
    }, []);

    const togglePlay = useCallback((): void => {
        const el = audioRef.current;
        if (!el) return;
        if (el.paused) void el.play().catch(() => undefined);
        else el.pause();
    }, []);

    const handleSeek = useCallback((seconds: number): void => {
        const el = audioRef.current;
        if (!el) return;
        el.currentTime = seconds;
        setTime(seconds);
    }, []);

    return (
        <div className={`flex w-full max-w-xl flex-col gap-3`}>
            <div className={`flex items-center gap-3`}>
                <Button
                    type={`button`}
                    onClick={togglePlay}
                    size={`icon`}
                    variant={`default`}
                    aria-label={t?.toggleAriaLabel ?? `Toggle playback`}
                    className={`rounded-full`}
                >
                    {playing ? <Pause /> : <Play className={`translate-x-[1px]`} />}
                </Button>
                <p className={`text-sm text-muted-foreground`}>
                    {t?.instructions ??
                        `Press play and watch the active line follow the playhead. Click any line to seek the audio back.`}
                </p>
            </div>
            <Lyrics source={SAMPLE_LRC} currentTime={time} onSeek={handleSeek} />
            <audio
                ref={audioRef}
                src={AUDIO_SRC}
                preload={`metadata`}
                crossOrigin={`anonymous`}
                className={`sr-only`}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.lyrics.synced,
    Example
};

export default module;
