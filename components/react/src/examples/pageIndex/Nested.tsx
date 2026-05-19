import PageIndex from "../../../lib/components/navigation/pageIndex/PageIndex";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const ITEMS = [
    { id: `pin-overview`, label: `Overview` },
    {
        id: `pin-examples`,
        label: `Examples`,
        children: [
            { id: `pin-examples-default`, label: `Default` },
            { id: `pin-examples-nested`, label: `Nested` }
        ]
    },
    { id: `pin-api`, label: `API` }
];

const Example = () => {
    useExampleState({
        topLevel: ITEMS.map((i) => i.id),
        nested: ITEMS.flatMap((i) => i.children?.map((c) => c.id) ?? [])
    });

    return (
        <div className={`flex gap-6`}>
            <div className={`flex flex-1 flex-col gap-4`}>
                <section
                    id={`pin-overview`}
                    className={`scroll-mt-20 rounded-md border bg-card p-4`}
                >
                    <p className={`font-medium`}>{`Overview`}</p>
                </section>
                <section
                    id={`pin-examples`}
                    className={`scroll-mt-20 rounded-md border bg-card p-4`}
                >
                    <p className={`font-medium`}>{`Examples`}</p>
                </section>
                <section
                    id={`pin-examples-default`}
                    className={`scroll-mt-20 rounded-md border bg-card p-4`}
                >
                    <p className={`font-medium`}>{`Examples · Default`}</p>
                </section>
                <section
                    id={`pin-examples-nested`}
                    className={`scroll-mt-20 rounded-md border bg-card p-4`}
                >
                    <p className={`font-medium`}>{`Examples · Nested`}</p>
                </section>
                <section
                    id={`pin-api`}
                    className={`scroll-mt-20 rounded-md border bg-card p-4`}
                >
                    <p className={`font-medium`}>{`API`}</p>
                </section>
            </div>
            <aside className={`w-44 flex-none self-start`}>
                <PageIndex items={ITEMS} />
            </aside>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.pageIndex.nested,
    Example
};

export default module;
