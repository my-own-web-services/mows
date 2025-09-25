import { cn } from "@/lib/utils";
import { type CSSProperties } from "react";

interface KeyComboDisplayProps {
    readonly keyCombo: string;
    readonly className?: string;
    readonly style?: CSSProperties;
}

export default function KeyComboDisplay({ keyCombo, className, style }: KeyComboDisplayProps) {
    const keys = keyCombo.split(" + ");

    return (
        <div className={cn("flex items-center gap-1", className)} style={style}>
            {keys.map((key, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                    <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex items-center justify-center rounded border px-1.5 py-1 pt-1.5 font-mono text-[10px] leading-none font-medium opacity-100 select-none">
                        {key}
                    </kbd>
                    {i < arr.length - 1 && <span className="text-muted-foreground text-xs">+</span>}
                </span>
            ))}
        </div>
    );
}
