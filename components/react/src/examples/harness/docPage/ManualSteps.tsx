import * as React from "react";
import { cn } from "../../../../lib/lib/utils";

interface ManualStepProps {
    readonly stepNumber: number;
    readonly isLast?: boolean;
    readonly children: React.ReactNode;
}

/**
 * One numbered step in `<ManualSteps>` — circle indicator on the left,
 * connector to the next step, content on the right. Used inside the
 * Installation > Manual tab and any other "do this, then this" layout.
 */
export const ManualStep = ({ stepNumber, isLast = false, children }: ManualStepProps) => (
    <li className={`flex gap-4`}>
        <div className={`flex flex-col items-center`}>
            <span
                aria-hidden
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-background text-sm font-medium`}
            >
                {stepNumber}
            </span>
            {!isLast && <span aria-hidden className={`my-2 w-px flex-1 bg-border`} />}
        </div>
        <div className={`flex flex-1 flex-col gap-3 pb-6`}>{children}</div>
    </li>
);

interface ManualStepsProps {
    readonly children: React.ReactNode;
    readonly className?: string;
}

/**
 * Vertical ordered list of `<ManualStep>` entries — the shadcn-docs
 * "Manual install" pattern (1. install dep, 2. paste code, 3. update
 * imports). Each child should be a `<ManualStep stepNumber={...}>`; pass
 * `isLast` on the final one to suppress the trailing connector line.
 */
export const ManualSteps = ({ children, className }: ManualStepsProps) => (
    <ol className={cn(`flex flex-col gap-0`, className)}>{children}</ol>
);
