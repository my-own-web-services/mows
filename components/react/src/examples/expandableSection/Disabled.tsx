import ExpandableSection from "../../../lib/components/navigation/expandableSection/ExpandableSection";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: true });
    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <ExpandableSection
                header={
                    <span className={`text-sm font-medium`}>Plain header card</span>
                }
                disabled
            />
            <p className={`text-muted-foreground text-[11px]`}>
                Pass <code>disabled</code> when the section has nothing to reveal — the
                chevron disappears, the trigger reports as disabled to assistive tech,
                and clicks have no effect.
            </p>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.expandableSection.disabled,
    Example
};

export default module;
