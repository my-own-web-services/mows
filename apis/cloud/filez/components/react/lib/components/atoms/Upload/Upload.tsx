import ResourceList from "@/components/list/ResourceList/ResourceList";
import {
    ListResourceRequestBody,
    ListResourceResponseBody
} from "@/components/list/ResourceList/ResourceListTypes";
import ColumnListRowHandler from "@/components/list/ResourceList/rowHandlers/Column";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FilezContext } from "@/lib/filezContext/FilezContext";
import { log } from "@/lib/logging";
import { cn, formatFileSizeToHumanReadable } from "@/lib/utils";
import { SortDirection, StorageQuota } from "filez-client-typescript";
import { Folder, Upload as UploadIcon } from "lucide-react";
import { createRef, PureComponent, type CSSProperties, type ReactNode } from "react";
import DateTime from "../DateTime/DateTime";
import StorageQuotaPicker from "../StorageQuotaPicker";
import { handleFileUpload, UploadFileRequest, UploadProgressData } from "./handleUpload";
import ImagePreview from "./ImagePreview";

export interface UploadFile {
    readonly file: File;
    readonly id: string;
    readonly progress?: number;
    readonly error?: string;
    readonly status: "pending" | "uploading" | "completed" | "error";
    readonly path?: string;
}

interface UploadProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onUpload?: (files: File[], storageQuota?: StorageQuota) => void;
    readonly onFileRemove?: (fileId: string) => void;
    readonly getStorageQuotas?: () => Promise<StorageQuota[] | undefined>;
    readonly selectedStorageQuota?: StorageQuota;
    readonly onStorageQuotaChange?: (storageQuota?: StorageQuota) => void;
    readonly accept?: string;
    readonly multiple?: boolean;
    readonly maxSize?: number;
    readonly disabled?: boolean;
    readonly children?: ReactNode;
}

interface UploadState {
    readonly isDragOver: boolean;
    readonly selectedFiles: UploadFile[];
    readonly selectedStorageQuota?: StorageQuota;
}

export default class Upload extends PureComponent<UploadProps, UploadState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    private fileInputRef: HTMLInputElement | null = null;
    private folderInputRef: HTMLInputElement | null = null;
    resourceListRef = createRef<ResourceList<UploadFile>>();

    constructor(props: UploadProps) {
        super(props);
        this.state = {
            isDragOver: false,
            selectedFiles: [],
            selectedStorageQuota: props.selectedStorageQuota
        };
    }

    componentDidMount = async () => {};

    componentDidUpdate = (prevProps: UploadProps) => {
        if (this.props.selectedStorageQuota !== prevProps.selectedStorageQuota) {
            this.setState({ selectedStorageQuota: this.props.selectedStorageQuota });
        }
    };

    componentWillUnmount = () => {
        // Cleanup is now handled by individual ImagePreview components
    };

    // Recursively read all files from a directory entry
    readEntriesPromise = (
        directoryReader: FileSystemDirectoryReader
    ): Promise<FileSystemEntry[]> => {
        return new Promise((resolve, reject) => {
            directoryReader.readEntries(resolve, reject);
        });
    };

    // Get file from file entry
    getFileFromEntry = (fileEntry: FileSystemFileEntry): Promise<File> => {
        return new Promise((resolve, reject) => {
            fileEntry.file(resolve, reject);
        });
    };

    // Recursively traverse directory and collect all files
    traverseDirectory = async (entry: FileSystemEntry, path: string = ""): Promise<File[]> => {
        const files: File[] = [];

        if (entry.isFile) {
            try {
                const file = await this.getFileFromEntry(entry as FileSystemFileEntry);
                // Add the relative path to the file object
                Object.defineProperty(file, "webkitRelativePath", {
                    value: path + file.name,
                    writable: false
                });
                files.push(file);
            } catch (error) {
                log.error("Error reading file:", error);
            }
        } else if (entry.isDirectory) {
            const directoryEntry = entry as FileSystemDirectoryEntry;
            const directoryReader = directoryEntry.createReader();

            try {
                let entries: FileSystemEntry[] = [];
                let readEntries: FileSystemEntry[] = [];

                // Keep reading until we get all entries (Chrome has a limit per read)
                do {
                    readEntries = await this.readEntriesPromise(directoryReader);
                    entries = entries.concat(readEntries);
                } while (readEntries.length > 0);

                // Recursively process each entry
                for (const childEntry of entries) {
                    const childFiles = await this.traverseDirectory(
                        childEntry,
                        path + entry.name + "/"
                    );
                    files.push(...childFiles);
                }
            } catch (error) {
                log.error("Error reading directory:", error);
            }
        }

        return files;
    };

    // Extract all files from drag and drop items
    extractFilesFromItems = async (items: DataTransferItemList): Promise<File[]> => {
        const files: File[] = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            if (item.kind === "file") {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    const extractedFiles = await this.traverseDirectory(entry);
                    files.push(...extractedFiles);
                } else {
                    // Fallback to regular file if webkitGetAsEntry is not supported
                    const file = item.getAsFile();
                    if (file) {
                        files.push(file);
                    }
                }
            }
        }

        return files;
    };

    handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ isDragOver: true });
    };

    handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget === e.target) {
            this.setState({ isDragOver: false });
        }
    };

    handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        this.setState({ isDragOver: false });

        if (this.props.disabled) return;

        try {
            // First try to extract files using the DataTransferItem API for folder support
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                const files = await this.extractFilesFromItems(e.dataTransfer.items);
                this.processFiles(files);
            } else {
                // Fallback to regular file list if DataTransferItem API is not available
                const files = Array.from(e.dataTransfer.files);
                this.processFiles(files);
            }
        } catch (error) {
            log.error("Error processing dropped files:", error);
            // Fallback to regular file processing
            const files = Array.from(e.dataTransfer.files);
            this.processFiles(files);
        }
    };

    handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (this.props.disabled) return;

        const files = Array.from(e.target.files || []);
        this.processFiles(files);

        // Reset input value to allow selecting the same file again
        e.target.value = "";
    };

    processFiles = (files: File[]) => {
        const { accept, maxSize, multiple = true } = this.props;
        let validFiles = files;

        // Filter by accept type
        if (accept) {
            const acceptTypes = accept.split(",").map((type) => type.trim());
            validFiles = validFiles.filter((file) => {
                return acceptTypes.some((acceptType) => {
                    if (acceptType.startsWith(".")) {
                        return file.name.toLowerCase().endsWith(acceptType.toLowerCase());
                    }
                    if (acceptType.includes("*")) {
                        const [type] = acceptType.split("/");
                        return file.type.startsWith(type);
                    }
                    return file.type === acceptType;
                });
            });
        }

        // Filter by size
        if (maxSize) {
            validFiles = validFiles.filter((file) => file.size <= maxSize);
        }

        // Limit to one file if not multiple
        if (!multiple && validFiles.length > 0) {
            validFiles = [validFiles[0]];
        }

        if (validFiles.length > 0) {
            const newUploadFiles: UploadFile[] = validFiles.map((file, index) => ({
                id: `${Date.now()}-${index}`,
                file,
                status: "pending" as const,
                path: (file as any).webkitRelativePath || undefined
            }));

            if (!multiple) {
                // Replace all files for single file mode
                this.setState({ selectedFiles: newUploadFiles });
            } else {
                // Add to existing files for multiple file mode
                this.setState(
                    (prevState) => ({
                        selectedFiles: [...prevState.selectedFiles, ...newUploadFiles]
                    }),
                    () => {
                        log.debug("Updated selected files:", this.state.selectedFiles);
                        log.debug("ResourceList ref:", this.resourceListRef.current);
                        this.resourceListRef?.current?.refreshList();
                    }
                );
            }
        }
    };

    handleFileClick = () => {
        if (this.props.disabled) return;
        this.fileInputRef?.click();
    };

    handleFolderClick = () => {
        if (this.props.disabled) return;
        this.folderInputRef?.click();
    };

    handleFileRemove = (fileId: string) => {
        this.setState((prevState) => ({
            selectedFiles: prevState.selectedFiles.filter((file) => file.id !== fileId)
        }));
        this.props.onFileRemove?.(fileId);
    };

    handleStorageQuotaChange = (storageQuota?: StorageQuota) => {
        this.setState({ selectedStorageQuota: storageQuota });
        this.props.onStorageQuotaChange?.(storageQuota);
    };

    handleUpload = async () => {
        const { selectedFiles, selectedStorageQuota } = this.state;
        if (selectedFiles.length === 0) return;

        const files = selectedFiles.map((uploadFile) => uploadFile.file);

        if (this.props.onUpload) {
            // Use provided onUpload handler
            this.props.onUpload(files, selectedStorageQuota);
        } else {
            // Handle upload automatically
            await this.handleAutomaticUpload();
        }
    };

    handleAutomaticUpload = async () => {
        const { selectedFiles, selectedStorageQuota } = this.state;

        if (!this.context?.filezClient) {
            console.error("FilezClient not available for automatic upload");
            return;
        }

        if (!selectedStorageQuota) {
            console.error("Storage quota not selected for automatic upload");
            return;
        }

        // Update upload status for each file
        this.setState((prevState) => ({
            selectedFiles: prevState.selectedFiles.map((uploadFile) => ({
                ...uploadFile,
                status: "uploading" as const
            }))
        }));

        try {
            // Upload files sequentially
            for (let i = 0; i < this.state.selectedFiles.length; i++) {
                const uploadFile = this.state.selectedFiles[i];
                const uploadRequest: UploadFileRequest = {
                    file: uploadFile.file,
                    name: uploadFile.file.name,
                    mimeType: uploadFile.file.type
                };

                await handleFileUpload(
                    this.context.filezClient,
                    selectedStorageQuota,
                    uploadRequest,
                    (progress: UploadProgressData) => {
                        // Update progress for this specific file
                        this.setState(
                            (prevState) => ({
                                selectedFiles: prevState.selectedFiles.map((file, index) =>
                                    index === i
                                        ? {
                                              ...file,
                                              progress: progress.percentage,
                                              status:
                                                  progress.phase === "completed"
                                                      ? ("completed" as const)
                                                      : ("uploading" as const)
                                          }
                                        : file
                                )
                            }),
                            () => {
                                this.resourceListRef?.current?.loadItems();
                            }
                        );
                    }
                );
            }

            log.info(`Successfully uploaded ${this.state.selectedFiles.length} file(s)`);
        } catch (error) {
            log.error("Error during automatic upload:", error);

            // Mark all files as error
            this.setState((prevState) => ({
                selectedFiles: prevState.selectedFiles.map((uploadFile) => ({
                    ...uploadFile,
                    status: "error" as const,
                    error: error instanceof Error ? error.message : "Upload failed"
                }))
            }));
        }
    };

    renderFileList = () => {
        const { selectedFiles } = this.state;
        const { t } = this.context!;

        if (selectedFiles.length === 0) return null;

        return (
            <div className="flex min-h-0 w-full flex-1 flex-col space-y-2">
                <ResourceList<UploadFile>
                    className="min-h-0 w-full flex-1"
                    ref={this.resourceListRef}
                    initialRowHandler="ColumnListRowHandler"
                    resourceType="UploadFile"
                    getResourcesList={async (request: ListResourceRequestBody) => {
                        const { fromIndex, limit, sortBy, sortDirection } = request;

                        // Sort the files based on sortBy and sortDirection
                        let sortedFiles = [...this.state.selectedFiles];

                        if (sortBy) {
                            sortedFiles.sort((a, b) => {
                                let aValue: any;
                                let bValue: any;

                                // Handle nested properties like "file.name" or "file.size"
                                if (sortBy.includes(".")) {
                                    const keys = sortBy.split(".");
                                    aValue = keys.reduce((obj: any, key) => obj?.[key], a as any);
                                    bValue = keys.reduce((obj: any, key) => obj?.[key], b as any);
                                } else {
                                    aValue = (a as any)[sortBy];
                                    bValue = (b as any)[sortBy];
                                }

                                // Handle string comparison
                                if (typeof aValue === "string" && typeof bValue === "string") {
                                    const comparison = aValue.localeCompare(bValue);
                                    return sortDirection === SortDirection.Ascending
                                        ? comparison
                                        : -comparison;
                                }

                                // Handle numeric comparison
                                if (typeof aValue === "number" && typeof bValue === "number") {
                                    return sortDirection === SortDirection.Ascending
                                        ? aValue - bValue
                                        : bValue - aValue;
                                }

                                // Fallback to string comparison
                                const aStr = String(aValue || "");
                                const bStr = String(bValue || "");
                                const comparison = aStr.localeCompare(bStr);
                                return sortDirection === SortDirection.Ascending
                                    ? comparison
                                    : -comparison;
                            });
                        }

                        const items = sortedFiles.slice(fromIndex, fromIndex + limit);

                        const response: ListResourceResponseBody<UploadFile> = {
                            items,
                            totalCount: this.state.selectedFiles.length
                        };
                        return response;
                    }}
                    rowHandlers={[
                        new ColumnListRowHandler({
                            rowHeightPixels: 50,
                            selectAllTitle: t.upload.selectAll,
                            columns: [
                                {
                                    direction: SortDirection.Neutral,
                                    enabled: true,
                                    field: "file.image",
                                    disableSorting: true,
                                    label: "Image",
                                    minWidthPixels: 50,
                                    widthPercent: 5,
                                    disableLabel: true,
                                    render: (
                                        item: UploadFile,
                                        style: CSSProperties,
                                        className: string
                                    ) => {
                                        return (
                                            <ImagePreview
                                                key={item.id}
                                                file={item.file}
                                                fileId={item.id}
                                            />
                                        );
                                    }
                                },
                                {
                                    direction: SortDirection.Ascending,
                                    enabled: true,
                                    field: "file.name",
                                    label: "Name",
                                    minWidthPixels: 150,
                                    widthPercent: 25,
                                    render: (
                                        item: UploadFile,
                                        style: CSSProperties,
                                        className: string
                                    ) => {
                                        return <span>{item.file.name}</span>;
                                    }
                                },
                                {
                                    direction: SortDirection.Neutral,
                                    enabled: true,
                                    field: "file.size",
                                    label: "Size",
                                    minWidthPixels: 100,
                                    widthPercent: 8,
                                    render: (
                                        item: UploadFile,
                                        style: CSSProperties,
                                        className: string
                                    ) => {
                                        return (
                                            <span title={`${item.file.size} bytes`}>
                                                {formatFileSizeToHumanReadable(item.file.size)}
                                            </span>
                                        );
                                    }
                                },
                                {
                                    direction: SortDirection.Neutral,
                                    enabled: true,
                                    field: "file.lastModified",
                                    label: "Last Modified",
                                    minWidthPixels: 200,
                                    widthPercent: 12,
                                    render: (
                                        item: UploadFile,
                                        style: CSSProperties,
                                        className: string
                                    ) => {
                                        return (
                                            <DateTime
                                                timestampMilliseconds={item.file.lastModified}
                                            />
                                        );
                                    }
                                },
                                {
                                    direction: SortDirection.Neutral,
                                    enabled: true,
                                    field: "path",
                                    label: "Path",
                                    minWidthPixels: 200,
                                    widthPercent: 25,
                                    render: (
                                        item: UploadFile,
                                        style: CSSProperties,
                                        className: string
                                    ) => {
                                        return <span>{item.path || "-"}</span>;
                                    }
                                },
                                {
                                    direction: SortDirection.Neutral,
                                    enabled: true,
                                    field: "status",
                                    label: "Status",
                                    minWidthPixels: 150,
                                    widthPercent: 25,
                                    render: (
                                        item: UploadFile,
                                        style: CSSProperties,
                                        className: string
                                    ) => {
                                        const { status, progress, error } = item;

                                        if (status === "pending") {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-muted-foreground text-sm">
                                                        {t.upload.status.pending}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        if (status === "uploading") {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <Progress
                                                        value={progress || 0}
                                                        className="flex-1"
                                                    />
                                                    <span className="text-muted-foreground min-w-[40px] text-sm">
                                                        {progress || 0}%
                                                    </span>
                                                </div>
                                            );
                                        }

                                        if (status === "completed") {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-green-600">
                                                        {t.upload.status.completed}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        if (status === "error") {
                                            return (
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="text-sm text-red-600"
                                                        title={error}
                                                    >
                                                        {t.upload.status.error}
                                                    </span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        );
                                    }
                                }
                            ]
                        })
                    ]}
                ></ResourceList>
                <div className="flex w-full items-center justify-between gap-4">
                    <div className="max-w-[400px] flex-1">
                        <StorageQuotaPicker
                            className="w-full"
                            value={this.state.selectedStorageQuota}
                            onValueChange={this.handleStorageQuotaChange}
                            getStorageQuotas={this.props.getStorageQuotas}
                            disabled={this.props.disabled}
                        />
                    </div>
                    <Button
                        onClick={this.handleUpload}
                        disabled={this.props.disabled || !this.state.selectedStorageQuota}
                        className="min-w-[100px] flex-shrink-0"
                    >
                        {t.upload.uploadFiles}
                    </Button>
                </div>
            </div>
        );
    };

    render = () => {
        const { isDragOver } = this.state;
        const { disabled = false, children, accept, multiple = true } = this.props;
        const { t } = this.context!;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn("Upload flex h-full w-full flex-col", this.props.className)}
            >
                <div
                    className={cn(
                        "w-full flex-shrink-0 rounded-lg border-2 border-dashed p-6 transition-colors",
                        "hover:border-primary/50 hover:bg-accent/50",
                        isDragOver && "border-primary bg-accent/50",
                        disabled && "pointer-events-none cursor-not-allowed opacity-50"
                    )}
                    onDragEnter={this.handleDragEnter}
                    onDragLeave={this.handleDragLeave}
                    onDragOver={this.handleDragOver}
                    onDrop={this.handleDrop}
                >
                    <input
                        ref={(ref) => {
                            this.fileInputRef = ref;
                        }}
                        type="file"
                        className="hidden"
                        onChange={this.handleFileSelect}
                        accept={accept}
                        multiple={multiple}
                        disabled={disabled}
                        tabIndex={-1}
                    />
                    <input
                        ref={(ref) => {
                            this.folderInputRef = ref;
                        }}
                        type="file"
                        className="hidden"
                        onChange={this.handleFileSelect}
                        multiple={true}
                        disabled={disabled}
                        tabIndex={-1}
                        {...({ webkitdirectory: "true" } as any)}
                    />
                    {children || (
                        <div className="space-y-4">
                            <div className="flex flex-col items-center justify-center space-y-3">
                                <UploadIcon className="text-muted-foreground h-10 w-10" />
                                <div className="text-center">
                                    <p className="text-sm font-medium">
                                        {t.upload.dropFilesOrFoldersHere}
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-xs">
                                        {t.upload.orUseButtonsBelow}
                                    </p>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={this.handleFileClick}
                                    disabled={disabled}
                                    className={cn(
                                        "relative cursor-pointer rounded-md border border-dashed border-gray-300 p-4 transition-colors",
                                        "hover:border-primary/50 hover:bg-accent/50",
                                        "focus:ring-ring focus:ring-2 focus:ring-offset-2",
                                        disabled && "cursor-not-allowed opacity-50"
                                    )}
                                    aria-label={t.upload.selectFiles}
                                >
                                    <div className="flex flex-col items-center space-y-2">
                                        <svg
                                            className="text-muted-foreground h-6 w-6"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                        </svg>
                                        <span className="text-sm font-medium">
                                            {t.upload.selectFiles}
                                        </span>
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={this.handleFolderClick}
                                    disabled={disabled}
                                    className={cn(
                                        "relative cursor-pointer rounded-md border border-dashed border-gray-300 p-4 transition-colors",
                                        "hover:border-primary/50 hover:bg-accent/50",
                                        "focus:ring-ring focus:ring-2 focus:ring-offset-2",
                                        disabled && "cursor-not-allowed opacity-50"
                                    )}
                                    aria-label={t.upload.orClickToSelectFolder}
                                >
                                    <div className="flex flex-col items-center space-y-2">
                                        <Folder className="text-muted-foreground h-6 w-6" />
                                        <span className="text-sm font-medium">
                                            {t.upload.orClickToSelectFolder}
                                        </span>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                {this.renderFileList()}
            </div>
        );
    };
}
