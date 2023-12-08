import { getIconName } from "../fileIcons/FileIcon";
import { Item } from "./DraggableItem";

export const generateDndPreview = ({
    itemType,
    item,
    style,
    ref
}: {
    itemType: string;
    item: Item;
    style: React.CSSProperties;
    ref: React.RefObject<HTMLDivElement>;
}) => {
    const selectedItems = item.getSelectedItems?.();
    if (!selectedItems) {
        return null;
    }

    const imagePath = `/file-icons/${getIconName(item?.resource?.name)}.svg`;

    return (
        <div
            style={{
                ...style,
                zIndex: 10
            }}
            ref={ref}
        >
            <div
                style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    userSelect: "none",
                    backgroundColor: "var(--bg2)",
                    borderRadius: "4px",
                    width: "60px",
                    height: "28px",
                    outline: "1px solid var(--fg)"
                }}
            >
                {selectedItems.length === 1 ? (
                    <img
                        src={imagePath}
                        alt=""
                        style={{
                            position: "absolute",
                            width: "20px",
                            height: "20px",
                            top: "3.5px",
                            left: "2px"
                        }}
                    />
                ) : (
                    <div>
                        <img
                            src={imagePath}
                            alt=""
                            style={{
                                position: "absolute",
                                width: "20px",
                                height: "20px",
                                top: "2px",
                                left: "2px"
                            }}
                        />
                        <img
                            src={imagePath}
                            alt=""
                            style={{
                                position: "absolute",
                                width: "20px",
                                height: "20px",
                                top: "5px",
                                left: "5px",
                                clipPath: "inset(15px 4px -5px 0px)"
                            }}
                        />
                        <img
                            src={imagePath}
                            alt=""
                            style={{
                                position: "absolute",
                                width: "20px",
                                height: "20px",
                                top: "5px",
                                left: "5px",
                                clipPath: "inset(4px -18px -42px 12px)"
                            }}
                        />
                    </div>
                )}
                <span
                    style={{
                        opacity: "100%",
                        zIndex: 5,
                        position: "absolute",
                        top: "4px",
                        left: "27px"
                    }}
                >
                    {selectedItems.length}
                </span>
            </div>
        </div>
    );
};
