import { Smile } from "lucide-react";
import { useState } from "react";
import EmojiPicker from "../../../lib/components/input/emojiPicker/EmojiPicker";
import { Button } from "../../../lib/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "../../../lib/components/ui/popover";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState<string>(`Tell us how you feel… `);
    const [open, setOpen] = useState(false);
    useExampleState({ value, open });
    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <div
                className={`bg-muted/40 flex min-h-14 items-center rounded-md border px-3 text-base`}
            >
                {value}
            </div>
            <div className={`flex justify-end`}>
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button variant={`outline`} size={`sm`}>
                            <Smile /> Add emoji
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent align={`end`} className={`w-auto overflow-hidden p-0`}>
                        <EmojiPicker
                            onSelect={(emoji) => {
                                setValue((prev) => `${prev}${emoji}`);
                                setOpen(false);
                            }}
                            className={`border-0 shadow-none`}
                        />
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.emojiPicker.inPopover,
    Example
};

export default module;
