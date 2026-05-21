import PageIndex from "../../../lib/components/navigation/pageIndex/PageIndex";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const SECTIONS = [
    { id: `pi-intro`, label: `Introduction` },
    { id: `pi-install`, label: `Installation` },
    { id: `pi-usage`, label: `Usage` },
    { id: `pi-api`, label: `API` },
    { id: `pi-examples`, label: `Examples` }
];

const Example = () => {
    useExampleState({ sections: SECTIONS.map((s) => s.id) });

    return (
        <div className={`flex gap-6`}>
            <div className={`flex flex-1 flex-col gap-6`}>
                {SECTIONS.map((s) => (
                    <section
                        key={s.id}
                        id={s.id}
                        className={`scroll-mt-20 rounded-md border bg-card p-6`}
                    >
                        <h3 className={`mb-2 text-lg font-semibold`}>{s.label}</h3>
                        <p className={`text-sm text-muted-foreground`}>
                            {`Placeholder content for the "${s.label}" section. Scroll the demo area or click an entry on the right to jump here.`}
                        </p>
                        <div className={`mt-4 h-40 rounded bg-muted/40`} />
                    </section>
                ))}
            </div>
            <aside className={`w-44 flex-none self-start`}>
                <PageIndex items={SECTIONS} />
            </aside>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.pageIndex.default,
    Example
};

export default module;
