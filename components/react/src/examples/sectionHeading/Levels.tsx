import SectionHeading from "../../../lib/components/navigation/sectionHeading/SectionHeading";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ levels: [1, 2, 3, 4, 5, 6] });

    return (
        <div className={`flex flex-col gap-3`}>
            <SectionHeading id={`sh-h1`} level={1} className={`text-3xl font-bold`}>
                {`H1 — Page title`}
            </SectionHeading>
            <SectionHeading id={`sh-h2`} level={2} className={`text-2xl font-semibold`}>
                {`H2 — Section`}
            </SectionHeading>
            <SectionHeading id={`sh-h3`} level={3} className={`text-xl font-semibold`}>
                {`H3 — Subsection`}
            </SectionHeading>
            <SectionHeading id={`sh-h4`} level={4} className={`text-base font-semibold`}>
                {`H4 — Sub-subsection`}
            </SectionHeading>
            <SectionHeading id={`sh-h5`} level={5} className={`text-sm font-semibold`}>
                {`H5 — Detail`}
            </SectionHeading>
            <SectionHeading id={`sh-h6`} level={6} className={`text-xs font-semibold uppercase`}>
                {`H6 — Smallest`}
            </SectionHeading>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.sectionHeading.levels,
    Example
};

export default module;
