import { FC, useEffect } from "react";
import { useDrag } from "react-dnd";
import ResourceList, { BaseResource } from "../list/resource/ResourceList";
import { getEmptyImage } from "react-dnd-html5-backend";

interface DraggableItemProps<Resource> {
    readonly type: string;
    readonly ids?: string[];
    readonly resource: Resource;
    readonly getSelectedItems?: InstanceType<typeof ResourceList>["getSelectedItems"];
    readonly dropHandler?: InstanceType<typeof ResourceList>["onDrop"];
    readonly children?: React.ReactNode;
    readonly style?: React.CSSProperties;
}

interface DropResult {
    readonly id: string;
}

export interface Item {
    getSelectedItems?: InstanceType<typeof ResourceList>["getSelectedItems"];
    resource: BaseResource;
}

export const DraggableItem: FC<DraggableItemProps<BaseResource>> = props => {
    const item: Item = { getSelectedItems: props.getSelectedItems, resource: props.resource };

    const [{ isDragging }, drag, preview] = useDrag(() => ({
        type: props.type,
        options: {
            dropEffect: "copy"
        },
        item,
        end: (item, monitor) => {
            const dropResult = monitor.getDropResult<DropResult>();
            if (item && dropResult) {
                props.dropHandler?.(dropResult.id);
            }
        },

        collect: monitor => ({
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
