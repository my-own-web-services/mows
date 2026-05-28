import { useState } from "react";
import EmojiPicker from "../../../lib/components/input/emojiPicker/EmojiPicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [last, setLast] = useState<string | null>(null);
    useExampleState({ direction: `rtl`, last });
    return (
        <div dir={`rtl`} className={`flex flex-col items-center gap-3`}>
            <EmojiPicker
                onSelect={(emoji) => setLast(emoji)}
                strings={{
                    searchPlaceholder: `بحث عن الرموز التعبيرية…`,
                    searchAriaLabel: `بحث`,
                    recent: `المستخدمة مؤخرًا`,
                    noResults: `لا توجد نتائج.`,
                    skinToneAriaLabel: `لون البشرة`,
                    clearSearch: `مسح البحث`
                }}
            />
            <div className={`text-muted-foreground text-sm`}>
                آخر اختيار: <span className={`text-foreground text-base`}>{last ?? `—`}</span>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.emojiPicker.rtl,
    Example
};

export default module;
