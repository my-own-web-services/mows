import type { ReactNode } from "react";
import { useRef, useState } from "react";
import AudioPlayer, {
    type AudioPlayerHandle
} from "../../../lib/components/files/audioPlayer/AudioPlayer";
import Lyrics from "../../../lib/components/files/lyrics/Lyrics";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const CreditLink = ({
    href,
    children,
    license
}: {
    readonly href: string;
    readonly children: ReactNode;
    readonly license?: boolean;
}) => (
    <a
        href={href}
        target={`_blank`}
        rel={license ? `noreferrer license` : `noreferrer`}
        className={`underline underline-offset-2 hover:text-foreground`}
    >
        {children}
    </a>
);

// Audio: Brad Sucks — "Bad Sign" (track 4 of "Out of It", 3:52).
//   License: CC-BY-SA 3.0 — https://creativecommons.org/licenses/by-sa/3.0/
//   Source:  https://archive.org/details/jamendo-031187 (Jamendo album
//   #31187, mirrored on the Internet Archive). Hotlinked MP3 supports
//   range requests with `access-control-allow-origin: *`.
//
// LRC: community-authored synced lyrics from LRCLIB.net (CC0 lyric
//   metadata), keyed to this exact 232-second recording. Verified
//   matching duration between the LRC source (232.0s) and the
//   archive.org MP3 (232.2s). Lyrics text is Brad Sucks' own work,
//   covered by the same CC-BY-SA 3.0 license as the recording, so
//   attribution propagates to any consumer of this demo.
const BAD_SIGN_MP3 = `https://archive.org/download/jamendo-031187/04.mp3`;

const BAD_SIGN_LRC = `[ti:Bad Sign]
[ar:Brad Sucks]
[al:Out of It · CC-BY-SA 3.0]
[length:03:52]
[00:17.64]I was laying on the floor when you were gone
[00:22.45]Like it was something i could die from
[00:25.61]Now my head aches and your friends all think i'm dumb
[00:30.15]You said it's just a bit of bad blood
[00:33.99]I don't feel great but it doesn't bother me
[00:38.73]Because i don't have the energy
[00:42.76]And the x-ray doesn't tell me anything
[00:47.26]Or show me what the hell you see in me
[00:52.40]All my time has turned to days
[00:56.62]That i will waste till my dying day
[01:00.66]And all my bones have realigned
[01:06.08]And now i guess it was a bad sign
[01:09.76]I was praying to the lord for some fun
[01:31.77]But i guess he didn't have some
[01:36.00]And betraying everything that i'd become
[01:39.28]Just to prove it wasn't true love
[01:43.24]If i'm too late will you come and hurry me
[01:48.81]Like a kid among the dying leaves
[01:54.27]If my heart breaks will you drug and carry me
[01:57.45]Where we can talk about our chemistry
[02:02.22]All my time has turned to days
[02:06.51]That i will waste till my dying day
[02:09.96]And all my bones have realigned
[02:15.31]And now i guess it was a bad sign
[02:20.17]And now i guess it was a bad sign
[02:24.11]All my time has turned to days
[03:03.46]That i will waste till my dying day
[03:06.99]And when i tried i was ashamed
[03:12.10]And said i don't believe in saving face
[03:16.08]And all my clothes are still inside
[03:21.30]And broken up into little piles
[03:30.23]And all my bones have realigned
[03:32.12]And now i guess it was a bad sign
[03:34.51]Now i guess it was a bad sign
[03:39.09]And now i guess it was a bad sign`;

const Example = () => {
    const playerRef = useRef<AudioPlayerHandle>(null);
    const [time, setTime] = useState<number>(0);
    // Round to 1 decimal for the harness panel only — Lyrics still gets
    // the full-precision `time` so its active-line tracking isn't
    // quantized. Avoids 4 writes/sec of essentially-identical values.
    useExampleState({ currentTime: Math.round(time * 10) / 10 });

    const handleSeek = (seconds: number): void => {
        // Drive the audio via the imperative ref. Mirroring into local
        // state immediately makes the highlight jump on click instead
        // of waiting for the next timeupdate.
        playerRef.current?.seekTo(seconds);
        setTime(seconds);
    };

    // Attribution links rendered into the AudioPlayer's `trailing`
    // slot. The library's CC-BY-SA 3.0 license requires audible /
    // visible credit to the original artist + the license itself; the
    // LRC source on LRCLIB is also credited here for completeness.
    const credits = (
        <p className={`text-xs text-muted-foreground`}>
            Audio:{` `}
            <CreditLink href={`https://archive.org/details/jamendo-031187`}>
                Brad Sucks — "Bad Sign" on archive.org
            </CreditLink>
            {` `}·{` `}
            <CreditLink
                href={`https://creativecommons.org/licenses/by-sa/3.0/`}
                license
            >
                CC-BY-SA 3.0
            </CreditLink>
            {` `}·{` `}LRC sync from{` `}
            <CreditLink href={`https://lrclib.net/api/get/1562006`}>
                LRCLIB
            </CreditLink>
        </p>
    );

    return (
        <div className={`flex w-full max-w-2xl flex-col gap-4`}>
            <AudioPlayer
                ref={playerRef}
                src={BAD_SIGN_MP3}
                variant={`card`}
                title={`Bad Sign`}
                subtitle={`Brad Sucks`}
                preload={`metadata`}
                crossOrigin={`anonymous`}
                downloadable={false}
                onTimeUpdate={setTime}
                trailing={credits}
            />
            <Lyrics source={BAD_SIGN_LRC} currentTime={time} onSeek={handleSeek} />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.lyrics.synced,
    Example
};

export default module;
