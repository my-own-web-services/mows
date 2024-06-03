import { useEffect } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";
import {
    ResourceListGetSelectedItems,
    ResourceListRowHandlersOnDrop
} from "../list/resource/ResourceListTypes";

interface DraggableItemProps<FilezResource> {
    readonly type: string;
    readonly ids?: string[];
    readonly resource: FilezResource;
    readonly getSelectedItems: ResourceListGetSelectedItems<FilezResource>;
    readonly dropHandler?: ResourceListRowHandlersOnDrop<FilezResource>;
    readonly children?: React.ReactNode;
    readonly style?: React.CSSProperties;
}

interface DropResult {
    readonly id: string;
    readonly type: string;
}

export interface Item<FilezResource> {
    readonly getSelectedItems: ResourceListGetSelectedItems<FilezResource>;
    readonly resource: FilezResource;
}

export const DraggableItem = <FilezResource,>(
    props: DraggableItemProps<FilezResource>
) => {
    const item: Item<FilezResource> = {
        getSelectedItems: props.getSelectedItems,
        resource: props.resource
    };

    const [{ isDragging }, drag, preview] = useDrag(() => ({
        type: props.type,
        options: {
            dropEffect: "copy"
        },
        item,
        end: (it, monitor) => {
            const dropResult = monitor.getDropResult<DropResult>();

            if (dropResult) {
                const selectedItems = item.getSelectedItems();
                console.log(selectedItems);

                if (selectedItems.length === 0) {
                    console.log(item.resource);

                    selectedItems.push(item.resource);
                }

                props.dropHandler?.(
                    dropResult.id,
                    dropResult.type,
                    selectedItems
                );
            }
        },

        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId()
        })
    }));

    useEffect(() => {
        // this useEffect hides the default preview
        preview(getEmptyImage(), { captureDraggingState: true });
    }, []);

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                ...props.style
            }}
            ref={drag}
        >
            {props.children}
        </div>
    );
};
