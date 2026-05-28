import { useState } from "react";
import EmojiPicker from "../../../lib/components/input/emojiPicker/EmojiPicker";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [last, setLast] = useState<string | null>(null);
    useExampleState({ last });
    return (
        <div className={`flex flex-col items-center gap-3`}>
            <EmojiPicker onSelect={(emoji) => setLast(emoji)} />
            <div className={`text-muted-foreground text-sm`}>
                Last picked:{` `}
                <span className={`text-foreground text-base`}>{last ?? `—`}</span>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.emojiPicker.default,
    Example
};

export default module;
