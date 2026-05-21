import { ChevronDown, ChevronUp } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { useMows } from "@/lib/mowsContext/MowsContext";
import { cn } from "@/lib/utils";

export interface ExpandableCodeProps {
    /**
     * Height (in px) shown when collapsed. If the content is shorter than
     * this, the component just renders the content as-is — no expand
     * affordance.
     */
    readonly collapsedHeight?: number;
    /** Initial expanded state. Defaults to `false`. */
    readonly defaultExpanded?: boolean;
    readonly children: React.ReactNode;
    readonly className?: string;
    /** Overrides the translated "Expand" label. */
    readonly expandLabel?: string;
    /** Overrides the translated "Collapse" label. */
    readonly collapseLabel?: string;
}

/**
 * Wraps any content (typically a `<CodeViewer fitContent />`) in a
 * collapsible container. While collapsed, the content is clipped to
 * `collapsedHeight` and a gradient overlay fades the bottom into the
 * background; an Expand button reveals the full content. When the wrapped
 * content fits within `collapsedHeight` no affordance is shown — the
 * component is invisible in that case.
 */
export const ExpandableCode = ({
    collapsedHeight = 280,
    defaultExpanded = false,
    children,
    className,
    expandLabel,
    collapseLabel
}: ExpandableCodeProps) => {
    const mowsContext = useMows();
    const labels = mowsContext?.t.expandableCode;
    const resolvedExpand = expandLabel ?? labels?.expand ?? `Expand`;
    const resolvedCollapse = collapseLabel ?? labels?.collapse ?? `Collapse`;

    const [expanded, setExpanded] = React.useState(defaultExpanded);
    const [needsExpand, setNeedsExpand] = React.useState(false);
    const innerRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const el = innerRef.current;
        if (!el) return;
        const measure = () => {
            // scrollHeight reflects the full content height regardless of
            // the maxHeight currently applied to the wrapper.
            setNeedsExpand(el.scrollHeight > collapsedHeight + 1);
        };
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [collapsedHeight, children]);

    const showOverlay = needsExpand && !expanded;

    return (
        <div className={cn(`flex flex-col gap-2`, className)}>
            <div className={`relative`}>
                <div
                    ref={innerRef}
                    style={{
                        maxHeight: needsExpand && !expanded ? `${collapsedHeight}px` : undefined
                    }}
                    className={cn(`overflow-hidden`)}
                >
                    {children}
                </div>
                {showOverlay && (
                    <div
                        aria-hidden
                        className={`pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent`}
                    />
                )}
            </div>
            {needsExpand && (
                <div className={`flex justify-center`}>
                    <Button
                        type={`button`}
                        variant={`ghost`}
                        size={`sm`}
                        onClick={() => setExpanded((v) => !v)}
                    >
                        {expanded ? (
                            <>
                                <ChevronUp className={`mr-1 h-4 w-4`} />
                                {resolvedCollapse}
                            </>
                        ) : (
                            <>
                                <ChevronDown className={`mr-1 h-4 w-4`} />
                                {resolvedExpand}
                            </>
                        )}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ExpandableCode;
