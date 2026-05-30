import ExpandableSection from "../../../lib/components/navigation/expandableSection/ExpandableSection";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ open: false });

    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <ExpandableSection
                header={
                    <div className={`flex items-center justify-between text-sm`}>
                        <span className={`font-medium`}>Opening hours</span>
                        <span className={`text-muted-foreground text-xs`}>Mo–Fr 09:00–18:00</span>
                    </div>
                }
                expandLabel={`Expand opening hours`}
                collapseLabel={`Collapse opening hours`}
            >
                <ul className={`text-muted-foreground space-y-1 px-3 py-2 text-xs`}>
                    <li>Monday — 09:00–18:00</li>
                    <li>Tuesday — 09:00–18:00</li>
                    <li>Wednesday — 09:00–18:00</li>
                    <li>Thursday — 09:00–18:00</li>
                    <li>Friday — 09:00–18:00</li>
                    <li>Saturday — closed</li>
                    <li>Sunday — closed</li>
                </ul>
            </ExpandableSection>
            <ExpandableSection
                header={
                    <div className={`flex items-center justify-between text-sm`}>
                        <span className={`font-medium`}>Contact</span>
                        <span className={`text-muted-foreground text-xs`}>3 channels</span>
                    </div>
                }
            >
                <dl
                    className={`text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-xs`}
                >
                    <dt>Phone</dt>
                    <dd>+49 30 12345678</dd>
                    <dt>Email</dt>
                    <dd>hello@example.org</dd>
                    <dt>Web</dt>
                    <dd>example.org</dd>
                </dl>
            </ExpandableSection>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.expandableSection.default,
    Example
};

export default module;
