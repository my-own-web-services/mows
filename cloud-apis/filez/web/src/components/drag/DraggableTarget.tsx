import { CSSProperties, FC } from "preact/compat";
import { useDrop } from "react-dnd";
import "./DraggableTarget.scss";
interface DraggableTargetProps {
    readonly acceptType: string;
    readonly style?: CSSProperties;
}

export const DraggableTarget: FC<DraggableTargetProps> = props => {
    const [{ canDrop, isOver }, drop] = useDrop(() => ({
        accept: props.acceptType,
        drop: () => ({ name: "Dustbin" }),
        collect: monitor => ({
            isOver: monitor.isOver(),
            canDrop: monitor.canDrop()
        })
    }));

    const isActive = canDrop && isOver;

    return (
        <div
            style={{
                ...props.style
            }}
            className={`DraggableTarget${isActive ? " dragOverActive" : ""}`}
            ref={drop}
        >
            {props.children}
        </div>
    );
};
