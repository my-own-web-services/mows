import { FC } from "preact/compat";
import { useDrop } from "react-dnd";

export const DraggableTarget: FC = () => {
    const [{ canDrop, isOver }, drop] = useDrop(() => ({
        accept: "file",
        drop: () => ({ name: "Dustbin" }),
        collect: monitor => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop()
        })
    }));

    const isActive = canDrop && isOver;
    let backgroundColor = "#222";
    if (isActive) {
        backgroundColor = "darkgreen";
    } else if (canDrop) {
        backgroundColor = "darkkhaki";
    }

    return (
        <div ref={drop} style={{ backgroundColor }} data-testid="dustbin">
            {isActive ? "Release to drop" : "Drag a box here"}
        </div>
    );
};
