import * as SliderPrimitive from "@radix-ui/react-slider";
import * as React from "react";

import { cn } from "@/lib/utils";

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, min = 0, max = 100, ...props }, ref) => {
    // Radix renders one thumb per entry in the values array; map either the
    // controlled `value` or the `defaultValue` to thumbs so range sliders
    // (two-handle) work without callers having to render their own thumbs.
    const thumbs = React.useMemo(() => {
        if (Array.isArray(value)) return value;
        if (Array.isArray(defaultValue)) return defaultValue;
        // Neither prop is set — Radix's internal default is a single-thumb
        // slider, so render one thumb.
        return [min] as number[];
    }, [value, defaultValue, min]);

    return (
        <SliderPrimitive.Root
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            min={min}
            max={max}
            className={cn(
                `relative flex w-full cursor-pointer touch-none items-center px-2 select-none`,
                className
            )}
            {...props}
        >
            <SliderPrimitive.Track
                className={`bg-primary/20 relative h-1.5 w-full grow overflow-hidden rounded-full`}
            >
                <SliderPrimitive.Range className={`bg-primary absolute h-full`} />
            </SliderPrimitive.Track>
            {thumbs.map((_, i) => (
                <SliderPrimitive.Thumb
                    key={i}
                    className={`border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 cursor-pointer rounded-full border-2 shadow transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50`}
                />
            ))}
        </SliderPrimitive.Root>
    );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };
