import { cn } from "@/lib/utils";
import { File } from "lucide-react";
import { PureComponent, type CSSProperties } from "react";
import { fileIcons } from "./fileIcons";

interface FileIconProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly fileName: string;
    readonly size?: number;
}

interface FileIconState {
    readonly iconName: string;
    readonly iconUrl: string | null;
    readonly isLoading: boolean;
    readonly hasError: boolean;
}

interface FileIconData {
    name: string;
    fileExtensions?: string[];
    fileNames?: string[];
    light?: boolean;
}

export default class FileIcon extends PureComponent<FileIconProps, FileIconState> {
    constructor(props: FileIconProps) {
        super(props);
        this.state = {
            iconName: `file`,
            iconUrl: null,
            isLoading: true,
            hasError: false
        };
    }

    componentDidMount = async () => {
        this.loadIcon();
    };

    componentDidUpdate = (prevProps: FileIconProps) => {
        if (prevProps.fileName !== this.props.fileName) {
            this.loadIcon();
        }
    };

    loadIcon = async () => {
        this.setState({ isLoading: true, hasError: false });

        try {
            const iconName = this.getIconForFile(this.props.fileName);
            const iconUrl = await this.loadIconSvg(iconName);

            this.setState({
                iconName,
                iconUrl,
                isLoading: false,
                hasError: false
            });
        } catch (error) {
            console.error(`Error loading file icon:`, error);
            this.setState({
                iconName: `file`,
                iconUrl: null,
                isLoading: false,
                hasError: true
            });
        }
    };

    getIconForFile = (fileName: string): string => {
        const extension = this.getFileExtension(fileName);
        const baseName = this.getBaseName(fileName);

        // First, try to match by exact file name
        for (const icon of fileIcons.icons as FileIconData[]) {
            if (icon.fileNames && icon.fileNames.includes(baseName)) {
                return icon.name;
            }
        }

        // Then, try to match by file extension
        if (extension) {
            for (const icon of fileIcons.icons as FileIconData[]) {
                if (icon.fileExtensions && icon.fileExtensions.includes(extension.toLowerCase())) {
                    return icon.name;
                }
            }
        }

        // Return default icon if no match found
        return fileIcons.defaultIcon.name;
    };

    getFileExtension = (fileName: string): string | null => {
        const lastDotIndex = fileName.lastIndexOf(`.`);
        if (lastDotIndex === -1 || lastDotIndex === 0) {
            return null;
        }
        return fileName.substring(lastDotIndex + 1);
    };

    getBaseName = (fileName: string): string => {
        const lastSlashIndex = fileName.lastIndexOf(`/`);
        return lastSlashIndex === -1 ? fileName : fileName.substring(lastSlashIndex + 1);
    };

    loadIconSvg = async (iconName: string): Promise<string | null> => {
        try {
            const iconUrl = `assets/file-icons/${iconName}.svg`;

            // Test if the icon exists by making a fetch request
            const response = await fetch(iconUrl);
            if (response.ok) {
                return iconUrl;
            } else {
                throw new Error(`Icon not found: ${iconName}`);
            }
        } catch (error) {
            console.warn(`Could not load icon for ${iconName}:`, error);
            // Return null to fall back to inline SVG
            return null;
        }
    };

    render = () => {
        const { className, style, size = 24 } = this.props;
        const { iconUrl, isLoading, hasError } = this.state;

        if (isLoading) {
            return (
                <div
                    style={{ ...style, width: size, height: size }}
                    className={cn(`FileIcon flex items-center justify-center`, className)}
                >
                    <div
                        className={`animate-pulse rounded bg-gray-300`}
                        style={{ width: size, height: size }}
                    />
                </div>
            );
        }

        if (hasError || !iconUrl) {
            return (
                <div
                    style={{ ...style, width: size, height: size }}
                    className={cn(`FileIcon flex items-center justify-center rounded`, className)}
                >
                    <File size={size} className={`text-primary-foreground`} />
                </div>
            );
        }

        return (
            <div style={{ ...style }} className={cn(`FileIcon`, className)}>
                <img
                    src={iconUrl}
                    alt={`${this.props.fileName} file icon`}
                    width={size}
                    height={size}
                    className={`object-contain`}
                    onError={() => {
                        this.setState({ hasError: true });
                    }}
                />
            </div>
        );
    };
}
