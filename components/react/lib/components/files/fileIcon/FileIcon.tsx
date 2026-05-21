import { File } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import { getIconForFilePath, type MaterialIcon } from "vscode-material-icons";
import { iconUrlMap } from "virtual:mows-file-icons";
import { cn } from "../../../lib/utils";

// `virtual:mows-file-icons` is a tiny Vite plugin in this repo
// (vite-plugins/fileIconsVirtual.ts) that scans
// node_modules/vscode-material-icons/generated/icons/*.svg at plugin-load
// time and returns a single module exporting a `Record<icon-name,
// data-URL>` map. We use a virtual module instead of
// `import.meta.glob('...*.svg', { eager: true, query: '?url' })` because
// the eager glob expands into ~910 separate ESM `?url` module fetches in
// the dev server, which stalls the docs page on initial load. In the
// published library bundle the data URLs are inlined into the prebuilt
// JS, so consumers don't need this plugin themselves.
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
