import { CalendarClock, FileText, Map } from "lucide-react";
import ExpandableSection from "../../../lib/components/navigation/expandableSection/ExpandableSection";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ sections: 3 });

    return (
        <div className={`flex w-full max-w-md flex-col gap-2`}>
            <ExpandableSection
                header={
                    <div className={`flex items-center gap-2 text-sm`}>
                        <CalendarClock
                            className={`text-muted-foreground h-4 w-4`}
                            aria-hidden
                        />
                        <span className={`font-medium`}>Events</span>
                        <span className={`text-muted-foreground text-xs`}>2 upcoming</span>
                    </div>
                }
                defaultOpen
            >
                <ul className={`space-y-1 px-3 py-2 text-xs`}>
                    <li>2026-04-12 — Spring market</li>
                    <li>2026-04-19 — Open day</li>
                </ul>
            </ExpandableSection>
            <ExpandableSection
                header={
                    <div className={`flex items-center gap-2 text-sm`}>
                        <Map
                            className={`text-muted-foreground h-4 w-4`}
                            aria-hidden
                        />
                        <span className={`font-medium`}>Location</span>
                        <span className={`text-muted-foreground text-xs`}>48.37° N · 10.89° E</span>
                    </div>
                }
            >
                <p className={`text-muted-foreground px-3 py-2 text-xs`}>
                    Coordinates fall back to a short human-readable address resolved
                    upstream. Consumers supply whatever body fits their data.
                </p>
            </ExpandableSection>
            <ExpandableSection
                header={
                    <div className={`flex items-center gap-2 text-sm`}>
                        <FileText
                            className={`text-muted-foreground h-4 w-4`}
                            aria-hidden
                        />
                        <span className={`font-medium`}>Description</span>
                    </div>
                }
            >
                <p className={`text-muted-foreground px-3 py-2 text-xs`}>
                    Stacking multiple sections gives a panel-style layout where every
                    card shares the same chrome — exactly the pattern omniviv uses for
                    its PlacesPanel.
                </p>
            </ExpandableSection>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.expandableSection.stack,
    Example
};

export default module;
