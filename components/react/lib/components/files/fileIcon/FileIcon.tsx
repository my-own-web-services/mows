import { File } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import { getIconForFilePath, type MaterialIcon } from "vscode-material-icons";
import { iconUrlMap } from "virtual:mows-file-icons";
import { cn } from "../../../lib/utils";

// See vite-plugins/fileIconsVirtual.ts for why this is a virtual module.
const lookupIconUrl = (iconName: MaterialIcon): string | null =>
    iconUrlMap[iconName] ?? null;

interface FileIconProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly fileName: string;
    readonly size?: number;
}

interface FileIconState {
    readonly imageFailed: boolean;
}

export default class FileIcon extends PureComponent<FileIconProps, FileIconState> {
    constructor(props: FileIconProps) {
        super(props);
        this.state = { imageFailed: false };
    }

    componentDidUpdate = (previousProps: FileIconProps) => {
        if (previousProps.fileName !== this.props.fileName && this.state.imageFailed) {
            this.setState({ imageFailed: false });
        }
    };

    render = () => {
        const { className, style, size = 24, fileName } = this.props;
        const iconUrl = lookupIconUrl(getIconForFilePath(fileName));

        if (!iconUrl || this.state.imageFailed) {
            return (
                <div
                    style={{ ...style, width: size, height: size }}
                    className={cn(`FileIcon flex items-center justify-center rounded`, className)}
                >
                    <File size={size} className={`text-muted-foreground`} />
                </div>
            );
        }

        return (
            <div style={{ ...style }} className={cn(`FileIcon`, className)}>
                <img
                    src={iconUrl}
                    alt={`${fileName} file icon`}
                    width={size}
                    height={size}
                    className={`object-contain`}
                    onError={() => this.setState({ imageFailed: true })}
                />
            </div>
        );
    };
}
