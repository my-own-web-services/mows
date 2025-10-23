import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilezContext } from "@/lib/filezContext/FilezContext";
import { FileGroup, FileGroupType } from "filez-client-typescript";
import { PureComponent, type CSSProperties } from "react";

interface FileGroupCreateProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly onFileGroupCreated?: (fileGroup: FileGroup) => void;
    readonly onCancel?: () => void;
}

interface FileGroupCreateState {
    readonly name: string;
    readonly isCreating: boolean;
    readonly error: string | null;
}

export default class FileGroupCreate extends PureComponent<
    FileGroupCreateProps,
    FileGroupCreateState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: FileGroupCreateProps) {
        super(props);
        this.state = {
            name: "",
            isCreating: false,
            error: null
        };
    }

    handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        this.setState({ name: e.target.value, error: null });
    };

    handleCreate = async () => {
        const { name } = this.state;
        const { t } = this.context!;

        if (!name.trim()) {
            this.setState({ error: t.fileGroupCreate.nameRequired });
            return;
        }

        if (name.length > 256) {
            this.setState({ error: t.fileGroupCreate.nameTooLong });
            return;
        }

        this.setState({ isCreating: true, error: null });

        try {
            const response = await this.context?.filezClient.api.createFileGroup({
                file_group_name: name.trim(),
                file_group_type: FileGroupType.Manual
            });

            const createdFileGroup = response?.data?.data?.created_file_group;

            if (createdFileGroup) {
                this.props.onFileGroupCreated?.(createdFileGroup);
                this.setState({ name: "", isCreating: false });
            } else {
                this.setState({
                    error: t.fileGroupCreate.createFailed,
                    isCreating: false
                });
            }
        } catch (error) {
            this.setState({
                error: error instanceof Error ? error.message : t.fileGroupCreate.createFailed,
                isCreating: false
            });
        }
    };

    handleCancel = () => {
        this.setState({ name: "", error: null });
        this.props.onCancel?.();
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !this.state.isCreating) {
            e.preventDefault();
            this.handleCreate();
        }
    };

    render = () => {
        const { className, style } = this.props;
        const { name, isCreating, error } = this.state;
        const { t } = this.context!;

        return (
            <div className={className} style={style}>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label htmlFor="name" className="text-sm font-medium">
                            {t.fileGroupCreate.nameLabel}
                        </label>
                        <Input
                            id="name"
                            value={name}
                            onChange={this.handleNameChange}
                            onKeyDown={this.handleKeyDown}
                            placeholder={t.fileGroupCreate.namePlaceholder}
                            disabled={isCreating}
                            autoFocus
                            maxLength={256}
                        />
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={this.handleCancel} disabled={isCreating}>
                        {t.fileGroupCreate.cancel}
                    </Button>
                    <Button onClick={this.handleCreate} disabled={isCreating || !name.trim()}>
                        {isCreating ? t.fileGroupCreate.creating : t.fileGroupCreate.create}
                    </Button>
                </div>
            </div>
        );
    };
}
