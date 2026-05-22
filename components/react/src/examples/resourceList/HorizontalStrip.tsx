import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import FileViewer from "../../../lib/components/files/fileViewer/FileViewer";
import ResourceList from "../../../lib/components/list/ResourceList/ResourceList";
import {
    type BaseResource,
    type ListResourceRequestBody,
    type ListResourceResponseBody,
    type ListRowHandler,
    type RowComponentProps,
    RowRendererDirection,
    type SelectedItemsAfterKeypress,
    SortDirection
} from "../../../lib/components/list/ResourceList/ResourceListTypes";
import sampleLandscapeUrl from "../../assets/samples/landscape-2000.webp";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

interface Photo extends BaseResource {
    readonly id: string;
    readonly title: string;
    readonly photographer: string;
    readonly src: string;
    readonly mimeType: string;
}

const PHOTOGRAPHERS = [`Hexlerz`, `Aida`, `Ola`, `Mika`, `Tomek`, `Inara`, `Bo`, `Vesna`];

// 60 entries pointing at the same shipped sample asset — concrete enough
// to demonstrate `embedded` mode on FileViewer (60 images would otherwise
// thrash the network; here all decodes happen lazily as the user scrolls).
const PHOTOS: Photo[] = Array.from({ length: 60 }).map((_, i) => ({
    id: `photo-${(i + 1).toString().padStart(3, `0`)}`,
    title: `Frame ${i + 1}`,
    photographer: PHOTOGRAPHERS[i % PHOTOGRAPHERS.length]!,
    src: sampleLandscapeUrl,
    mimeType: `image/webp`
}));

const CARD_WIDTH = 220;

class HorizontalStripRowHandler<T extends BaseResource> implements ListRowHandler<T> {
    readonly id = `HorizontalStripRowHandler`;
    readonly name = `Strip`;
    readonly icon = (<LayoutGrid height={`100%`} />);
    readonly direction = RowRendererDirection.Horizontal;
    resourceList: import("../../../lib/components/list/ResourceList/ResourceList").default<T> | undefined;

    constructor(
        private readonly cardWidth: number,
        private readonly renderCard: (item: T) => React.ReactNode
    ) {}

    getMinimumBatchSize = () => 30;
    getLoadMoreItemsThreshold = () => 10;
    getRowHeight = () => this.cardWidth;
    getRowCount = (itemCount: number) => itemCount;
    getItemKey = (_items: (T | undefined)[], index: number) => index;
    isItemLoaded = (items: (T | undefined)[], index: number) => items[index] !== undefined;
    getStartIndexAndLimit = (startIndex: number, limit: number) => ({ startIndex, limit });

    rowRenderer = (rowProps: RowComponentProps<T>) => {
        const data = rowProps.data;
        if (!data) return null;
        const item = data.items[rowProps.index];
        if (!item) return null;
        return (
            <div style={{ ...rowProps.style, padding: 6 }}>{this.renderCard(item)}</div>
        );
    };

    getSelectedItemsAfterKeypress = (
        e: React.KeyboardEvent<HTMLDivElement>,
        _items: (T | undefined)[],
        total_count: number,
        _selectedItems: (boolean | undefined)[],
        lastSelectedItemIndex: number | undefined
    ): SelectedItemsAfterKeypress | undefined => {
        if (e.key !== `ArrowLeft` && e.key !== `ArrowRight`) return undefined;
        const current = lastSelectedItemIndex ?? 0;
        const delta = e.key === `ArrowLeft` ? -1 : 1;
        const next = (current + delta + total_count) % total_count;
        return { nextSelectedItemIndex: next, scrollToRowIndex: next };
    };
}

const Example = () => {
    const handlers = useMemo(
        () => [
            new HorizontalStripRowHandler<Photo>(CARD_WIDTH, (item) => (
                <div className={`bg-card flex h-full w-full flex-col overflow-hidden rounded-md border`}>
                    <div className={`bg-muted aspect-square w-full`}>
                        <FileViewer
                            src={item.src}
                            name={item.title}
                            mimeType={item.mimeType}
                            embedded
                        />
                    </div>
                    <div className={`flex flex-col gap-0.5 p-3`}>
                        <span className={`truncate text-sm font-medium`}>{item.title}</span>
                        <span className={`text-muted-foreground truncate text-xs`}>
                            by {item.photographer}
                        </span>
                    </div>
                </div>
            ))
        ],
        []
    );

    const getResourcesList = async (
        req: ListResourceRequestBody
    ): Promise<ListResourceResponseBody<Photo>> => ({
        items: PHOTOS.slice(req.fromIndex, req.fromIndex + req.limit),
        totalCount: PHOTOS.length
    });

    useExampleState({ totalItems: PHOTOS.length, cardWidth: CARD_WIDTH, embedded: true });

    return (
        <div className={`flex h-[320px] w-full flex-col rounded-md border bg-background`}>
            <ResourceList<Photo>
                listInstanceId={`example-resource-list-strip`}
                resourceType={`photo`}
                rowHandlers={handlers}
                initialRowHandler={handlers[0]!.id}
                getResourcesList={getResourcesList}
                defaultSortBy={`title`}
                defaultSortDirection={SortDirection.Ascending}
                displayListHeader={false}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.resourceList.horizontalStrip,
    Example
};

export default module;
