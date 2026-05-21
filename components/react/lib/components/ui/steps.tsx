import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type StepsOrientation = `horizontal` | `vertical`;
type StepStatus = `completed` | `current` | `upcoming`;
type StepsMode = `progress` | `selection`;

interface StepsContextValue {
    orientation: StepsOrientation;
    current: number;
    mode: StepsMode;
}

const StepsContext = React.createContext<StepsContextValue | null>(null);

const useStepsContext = (): StepsContextValue => {
    const ctx = React.useContext(StepsContext);
    if (!ctx) {
        throw new Error(`<Step> must be rendered inside <Steps>`);
    }
    return ctx;
};

interface StepsProps extends React.HTMLAttributes<HTMLOListElement> {
    orientation?: StepsOrientation;
    current: number;
    /**
     * `"progress"` (default) — earlier steps render completed (check icon,
     * primary fill, primary connector), the current step is highlighted, and
     * later steps are muted. Use for wizards that move forward through work.
     *
     * `"selection"` — no notion of completion: every step shows its number,
     * the active (`index === current`) circle is filled with the primary
     * color, all others are neutral. Connectors stay muted. Use when the
     * stepper is just a step picker.
     */
    mode?: StepsMode;
}

/**
 * Stepper indicator that shows progress through a sequence of steps.
 *
 * Children must be `<Step>` elements. Status is derived from `current`:
 * indices `< current` render as completed, `=== current` as current,
 * `> current` as upcoming. Override per-step via `<Step status>`.
 *
 * @example Horizontal (default)
 * ```tsx
 * <Steps current={1}>
 *     <Step title="Account" description="Sign up" />
 *     <Step title="Profile" description="Tell us about yourself" />
 *     <Step title="Done" />
 * </Steps>
 * ```
 *
 * @example Vertical
 * ```tsx
 * <Steps orientation="vertical" current={2}>
 *     <Step title="Pick a plan" />
 *     <Step title="Add payment" />
 *     <Step title="Confirm" />
 * </Steps>
 * ```
 *
 * @example Controlled with a wizard
 * ```tsx
 * const [step, setStep] = React.useState(0);
 * return (
 *     <>
 *         <Steps current={step}>
 *             <Step title="One" />
 *             <Step title="Two" />
 *             <Step title="Three" />
 *         </Steps>
 *         <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
 *     </>
 * );
 * ```
 *
 * @example Per-step status override (e.g. error state)
 * ```tsx
 * <Steps current={1}>
 *     <Step title="Upload" />
 *     <Step title="Process" status="current" />
 *     <Step title="Publish" status="upcoming" />
 * </Steps>
 * ```
 */
const Steps = React.forwardRef<HTMLOListElement, StepsProps>(
    (
        {
            orientation = `horizontal`,
            current,
            mode = `progress`,
            className,
            children,
            ...props
        },
        ref
    ) => {
        const childArray = React.Children.toArray(children);
        return (
            <StepsContext.Provider value={{ orientation, current, mode }}>
                <ol
                    ref={ref}
                    aria-orientation={orientation}
                    data-orientation={orientation}
                    className={cn(
                        `flex w-full`,
                        orientation === `horizontal` ? `flex-row` : `flex-col`,
                        className
                    )}
                    {...props}
                >
                    {childArray.map((child, index) => {
                        if (!React.isValidElement<StepProps>(child)) return child;
                        return React.cloneElement(child, {
                            index,
                            isFirst: index === 0,
                            isLast: index === childArray.length - 1
                        });
                    })}
                </ol>
            </StepsContext.Provider>
        );
    }
);
Steps.displayName = `Steps`;

interface StepProps extends Omit<React.HTMLAttributes<HTMLLIElement>, `title`> {
    title: React.ReactNode;
    description?: React.ReactNode;
    status?: StepStatus;
    /** Injected by <Steps>; do not set manually. */
    index?: number;
    /** Injected by <Steps>; do not set manually. */
    isFirst?: boolean;
    /** Injected by <Steps>; do not set manually. */
    isLast?: boolean;
}

/**
 * One step in a `<Steps>` indicator. Reads orientation and `current` from
 * the parent. The numeric badge is replaced with a check icon once the step
 * is `completed`.
 *
 * @example
 * ```tsx
 * <Step title="Configure" description="Choose your defaults" />
 * ```
 *
 * @example Force a status (overrides the parent's `current`)
 * ```tsx
 * <Step title="Review" status="completed" />
 * ```
 */
const Step = React.forwardRef<HTMLLIElement, StepProps>(
    (
        {
            title,
            description,
            status,
            index = 0,
            isFirst = false,
            isLast = false,
            className,
            ...props
        },
        ref
    ) => {
        const { orientation, current, mode } = useStepsContext();
        const resolvedStatus: StepStatus =
            status ??
            (mode === `selection`
                ? index === current
                    ? `current`
                    : `upcoming`
                : index < current
                  ? `completed`
                  : index === current
                    ? `current`
                    : `upcoming`);
        const isHorizontal = orientation === `horizontal`;
        const isSelection = mode === `selection`;

        const indicator = (
            <span
                aria-hidden
                data-status={resolvedStatus}
                className={cn(
                    `flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors`,
                    isSelection
                        ? resolvedStatus === `current`
                            ? `border-primary bg-primary text-primary-foreground`
                            : `border-border bg-background text-muted-foreground`
                        : resolvedStatus === `completed`
                          ? `border-primary bg-primary text-primary-foreground`
                          : resolvedStatus === `current`
                            ? `border-primary bg-background text-primary`
                            : `border-border bg-background text-muted-foreground`
                )}
            >
                {!isSelection && resolvedStatus === `completed` ? (
                    <Check className={`h-4 w-4`} />
                ) : (
                    index + 1
                )}
            </span>
        );

        const titleNode = (
            <span
                data-status={resolvedStatus}
                className={cn(
                    `text-sm font-medium`,
                    resolvedStatus === `upcoming`
                        ? `text-muted-foreground`
                        : `text-foreground`
                )}
            >
                {title}
            </span>
        );

        const descriptionNode = description ? (
            <span className={`text-xs text-muted-foreground`}>{description}</span>
        ) : null;

        if (isHorizontal) {
            const isMiddle = !isFirst && !isLast;
            const isSingle = isFirst && isLast;
            const beforeConnectorPrimary =
                !isSelection &&
                (resolvedStatus === `completed` || resolvedStatus === `current`);
            const afterConnectorPrimary =
                !isSelection && resolvedStatus === `completed`;
            return (
                <li
                    ref={ref}
                    data-status={resolvedStatus}
                    aria-current={resolvedStatus === `current` ? `step` : undefined}
                    className={cn(
                        `flex flex-1 flex-col`,
                        isSingle && `flex-none`,
                        className
                    )}
                    {...props}
                >
                    <div
                        className={cn(
                            `flex w-full items-center`,
                            isLast && !isFirst
                                ? `justify-end`
                                : isMiddle
                                  ? `justify-center`
                                  : `justify-start`
                        )}
                    >
                        {!isFirst && (
                            <span
                                aria-hidden
                                data-status={resolvedStatus}
                                data-connector={`before`}
                                className={cn(
                                    `mr-2 h-px flex-1`,
                                    beforeConnectorPrimary ? `bg-primary` : `bg-border`
                                )}
                            />
                        )}
                        {indicator}
                        {!isLast && (
                            <span
                                aria-hidden
                                data-status={resolvedStatus}
                                data-connector={`after`}
                                className={cn(
                                    `ml-2 h-px flex-1`,
                                    afterConnectorPrimary ? `bg-primary` : `bg-border`
                                )}
                            />
                        )}
                    </div>
                    <div
                        className={cn(
                            `mt-2 flex flex-col`,
                            isLast && !isFirst
                                ? `items-end text-right`
                                : isMiddle
                                  ? `items-center text-center`
                                  : `items-start text-left`
                        )}
                    >
                        {titleNode}
                        {descriptionNode}
                    </div>
                </li>
            );
        }

        return (
            <li
                ref={ref}
                data-status={resolvedStatus}
                aria-current={resolvedStatus === `current` ? `step` : undefined}
                className={cn(`flex gap-3`, className)}
                {...props}
            >
                <div className={`flex flex-col items-center`}>
                    {indicator}
                    {!isLast && (
                        <span
                            aria-hidden
                            data-status={resolvedStatus}
                            className={cn(
                                `my-1 w-px flex-1`,
                                !isSelection && resolvedStatus === `completed`
                                    ? `bg-primary`
                                    : `bg-border`
                            )}
                        />
                    )}
                </div>
                <div className={cn(`flex flex-col`, !isLast && `pb-4`)}>
                    {titleNode}
                    {descriptionNode}
                </div>
            </li>
        );
    }
);
Step.displayName = `Step`;

export {
    Step,
    Steps,
    type StepProps,
    type StepsMode,
    type StepsOrientation,
    type StepsProps,
    type StepStatus
};
