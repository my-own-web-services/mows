import { FC } from "preact/compat";
import { useDrag } from "react-dnd";

interface DraggableItemProps {}

interface DropResult {
    readonly name: string;
}

export const DraggableItem: FC<DraggableItemProps> = props => {
    const [{ isDragging }, drag] = useDrag(() => ({
        type: "file",
        item: { name: "123" },
        end: (item, monitor) => {
            const dropResult = monitor.getDropResult<DropResult>();
            if (item && dropResult) {
                alert(`You dropped ${item.name} into ${dropResult.name}!`);
            }
        },
        collect: monitor => ({
            isDragging: monitor.isDragging(),
            handlerId: monitor.getHandlerId()
        })
    }));

    const opacity = isDragging ? 0.4 : 1;
    return (
        <div style={{ height: "100%" }} ref={drag}>
            {props.children}
        </div>
    );
};
