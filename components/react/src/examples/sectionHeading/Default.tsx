import SectionHeading from "../../../lib/components/navigation/sectionHeading/SectionHeading";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ level: 3, id: `sh-demo-default` });

    return (
        <SectionHeading id={`sh-demo-default`} level={3} className={`text-xl font-semibold`}>
            {`Hover me to reveal the # anchor`}
        </SectionHeading>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.sectionHeading.default,
    Example
};

export default module;
