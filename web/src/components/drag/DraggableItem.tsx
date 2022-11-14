import { FC } from "preact/compat";
import { useDrag } from "react-dnd";

interface DraggableItemProps {
    readonly type: string;
    readonly id: string;
}

interface DropResult {
    readonly name: string;
}

export const DraggableItem: FC<DraggableItemProps> = props => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: props.type,
        item: { id: props.id },
        end: (item, monitor) => {
            const dropResult = monitor.getDropResult<DropResult>();
            if (item && dropResult) {
                console.log(`You dropped ${item.id} into ${dropResult.name}!`);
            }
        },
        collect: monitor => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId()
        })
    }));

    return (
        <div style={{ height: "100%" }} ref={drag}>
            {props.children}
        </div>
    );
};
