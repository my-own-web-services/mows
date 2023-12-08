import { CSSProperties, FC } from "react";
import { useDrop } from "react-dnd";

interface DraggableTargetProps {
    readonly acceptType: string;
    readonly style?: CSSProperties;
    readonly children?: React.ReactNode;
    readonly id: string;
    readonly canDrop?: () => boolean;
}

export const DraggableTarget: FC<DraggableTargetProps> = props => {
    const [{ canDrop, isOver, isDragging }, drop] = useDrop(() => ({
        accept: props.acceptType,
        options: {},
        drop: () => ({ id: props.id }),
        collect: monitor => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop(),
            isDragging: monitor.getItem() !== null
        }),
        canDrop: props.canDrop
    }));

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                opacity: isDragging && !canDrop ? 0.5 : 1,
                ...props.style
            }}
            className={`DraggableTarget${canDrop && isOver ? " dragOverActive" : ""}`}
            ref={drop}
        >
            {props.children}
        </div>
    );
};
