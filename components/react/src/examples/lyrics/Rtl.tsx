import { useState } from "react";
import Lyrics from "../../../lib/components/files/lyrics/Lyrics";
import { Slider } from "../../../lib/components/ui/slider";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SAMPLE_LRC_RTL = `[ti:صباح الخير]
[ar:جوقة العرض]
[00:00.00]جمعنا الصباح في حقيبة واحدة
[00:04.20]عددنا كل خطوة على الجسر
[00:08.80]طرق لم نرها من قبل تنادينا
[00:13.30]وهبت ريح فحملتنا إلى النور
[00:18.00]تنفّس ببطء، النهر يواصل المسير
[00:22.40]سنجد مكاناً هادئاً قبل الفجر`;

const DURATION = 26;

const Example = () => {
    const [time, setTime] = useState<number>(10);
    useExampleState({ direction: `rtl`, currentTime: time });

    return (
        <div dir={`rtl`} className={`flex w-full max-w-xl flex-col gap-4`}>
            <Lyrics source={SAMPLE_LRC_RTL} currentTime={time} onSeek={setTime} />
            <Slider
                aria-label={`Scrub`}
                value={[time]}
                min={0}
                max={DURATION}
                step={0.1}
                onValueChange={(v) => setTime(v[0])}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.lyrics.rtl,
    Example
};

export default module;
