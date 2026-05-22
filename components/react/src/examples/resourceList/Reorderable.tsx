import { useMemo, useState } from "react";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import ColumnListRowHandler, {
    type Column
} from "../../../lib/components/list/ResourceList/rowHandlers/Column";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface PlaylistTrack extends BaseResource {
    readonly id: string;
    readonly title: string;
    readonly artist: string;
    readonly duration: string;
}

const SEED: PlaylistTrack[] = [
    { id: `t-01`, title: `Nightcall`, artist: `Kavinsky`, duration: `4:18` },
    { id: `t-02`, title: `A Real Hero`, artist: `College & Electric Youth`, duration: `4:25` },
    { id: `t-03`, title: `Tycho — Awake`, artist: `Tycho`, duration: `5:21` },
    { id: `t-04`, title: `Strangers`, artist: `Sigrid`, duration: `3:23` },
    { id: `t-05`, title: `Midnight City`, artist: `M83`, duration: `4:04` },
    { id: `t-06`, title: `Resonance`, artist: `Home`, duration: `3:32` },
    { id: `t-07`, title: `Voyager`, artist: `Daft Punk`, duration: `4:42` }
];

const Example = () => {
    const [tracks, setTracks] = useState<PlaylistTrack[]>(SEED);

    // The list always reads the current snapshot of `tracks`, so any
    // reorder applied via setState is reflected immediately on the next
    // window load.
    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<PlaylistTrack>> => ({
        items: tracks.slice(req.fromIndex, req.fromIndex + req.limit),
        totalCount: tracks.length
    });

    const handlers = useMemo(() => {
        const columns: Column<PlaylistTrack>[] = [
            {
                field: `title`,
                label: `Title`,
                direction: SortDirection.Neutral,
                widthPercent: 45,
                minWidthPixels: 140,
                enabled: true,
                disableSorting: true,
                render: (item) => <span className={`font-medium`}>{item.title}</span>
            },
            {
                field: `artist`,
                label: `Artist`,
                direction: SortDirection.Neutral,
                widthPercent: 40,
                minWidthPixels: 120,
                enabled: true,
                disableSorting: true,
                render: (item) => <span className={`text-muted-foreground`}>{item.artist}</span>
            },
            {
                field: `duration`,
                label: `Length`,
                direction: SortDirection.Neutral,
                widthPercent: 15,
                minWidthPixels: 70,
                enabled: true,
                disableSorting: true,
                render: (item) => <span className={`tabular-nums`}>{item.duration}</span>
            }
        ];
        return [
            new ColumnListRowHandler<PlaylistTrack>({
                columns,
                hideSelectionCheckboxColumn: true,
                hideColumnPicker: true
            })
        ];
    }, []);

    useExampleState({ trackOrder: tracks.map((t) => t.id), totalItems: tracks.length });

    return (
        <div className={`flex flex-col gap-3`}>
            <p className={`text-muted-foreground text-sm`}>
                Drag any row to reorder — a line shows where the row will land, and the
                drag image follows the cursor. The new order is surfaced via the harness
                state panel.
            </p>
            <div className={`h-[360px] w-full rounded-md border bg-background`}>
                <ResourceList<PlaylistTrack>
                    listInstanceId={`example-resource-list-reorderable`}
                    resourceType={`playlist-track`}
                    rowHandlers={handlers}
                    initialRowHandler={handlers[0]!.id}
                    getResourcesList={getResourcesList}
                    reorderable
                    handlers={{
                        onReorder: (fromIndex, toIndex) => {
                            setTracks((prev) => {
                                const next = prev.slice();
                                const [moved] = next.splice(fromIndex, 1);
                                if (!moved) return prev;
                                next.splice(toIndex, 0, moved);
                                return next;
                            });
                        }
                    }}
                />
            </div>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.reorderable,
    Example
};

export default module;
