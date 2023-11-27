import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import { InputPicker } from "rsuite";
import { UsageLimits } from "@firstdorsal/filez-client/dist/js/apiTypes/UsageLimits";
import { bytesToHumanReadableSize } from "../../utils";
import { FilezFile } from "@firstdorsal/filez-client/dist/js/apiTypes/FilezFile";

interface StoragePickerProps {
    readonly fileIds?: string[];
    readonly onChange?: (storage_id: string) => void;
    readonly disabled?: boolean;
}

interface StoragePickerState {
    readonly selectedStorageId: string | null;
    readonly availableStorages: StorageOptions[] | null;
    readonly files: FilezFile[] | null;
    readonly someFilesReadonly: boolean;
    readonly mixedStorages: boolean;
}

interface StorageOptions {
    storage_id: string;
    limits: UsageLimits;
}

export default class StoragePicker extends PureComponent<StoragePickerProps, StoragePickerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: StoragePickerProps) {
        super(props);
        this.state = {
            selectedStorageId: null,
            availableStorages: null,
            files: null,
            someFilesReadonly: false,
            mixedStorages: false
        };
    }

    componentDidMount = async () => {
        await this.getUserStorageLimits();
        await this.getFiles();
    };

    getFiles = async () => {
        if (!this.context) return;
        if (!this.props.fileIds) return;
        const files = await this.context.filezClient.get_file_infos(this.props.fileIds);

        const storage_ids = files.map(file => file.storage_id);
        const unique_storage_ids = [...new Set(storage_ids)];
        const someFilesReadonly = files.some(file => file.readonly);

        if (unique_storage_ids.length === 1) {
            this.setState({ selectedStorageId: unique_storage_ids[0], someFilesReadonly });
        } else {
            this.setState({ selectedStorageId: null, someFilesReadonly });
        }

        this.setState({ files });
    };

    getUserStorageLimits = async () => {
        if (!this.context) return;
        const own_user = await this.context.filezClient.get_own_user();
        if (!own_user.limits) return;

        const availableStorages: StorageOptions[] = [];
        for (const [storage_id, user_storage_limits] of Object.entries(own_user.limits)) {
            if (!user_storage_limits) continue;
            if (user_storage_limits.used_storage >= user_storage_limits.max_storage) continue;
            availableStorages.push({
                storage_id,
                limits: user_storage_limits
            });
        }
        if (availableStorages.length === 1) {
            this.setState({ selectedStorageId: availableStorages[0].storage_id });
        }
        this.setState({ availableStorages });
    };

    onChange = (value: string) => {
        this.setState({ selectedStorageId: value });
        if (this.props.onChange) this.props.onChange(value);
        if (!this.context) return;
        if (!this.props.fileIds || !this.state.files) return;
        const promises = this.state.files.map(file =>
            this.context?.filezClient.update_file_infos(file._id, { storage_id: value })
        );
        const responses = Promise.all(promises);
    };

    render = () => {
        if (this.state.availableStorages === null) return;
        if (this.props.fileIds && this.state.files === null) return;

        return (
            <div className="StoragePicker">
                <label className={this.props.disabled ? "disabled" : ""}>Storage</label>
                <br />
                <InputPicker
                    disabled={this.props.disabled ?? this.state.someFilesReadonly}
                    placeholder={(() => {
                        if (this.state.someFilesReadonly) return "Storage is readonly";
                        if (this.state.mixedStorages) return "Mixed storages";
                        return "Select storage";
                    })()}
                    data={this.state.availableStorages.map(storageOption => {
                        const label = `${storageOption.storage_id} (${bytesToHumanReadableSize(
                            storageOption.limits.used_storage
                        )} / ${bytesToHumanReadableSize(storageOption.limits.max_storage)} used)`;
                        return { label, value: storageOption.storage_id };
                    })}
                    value={this.state.selectedStorageId}
                    onChange={this.onChange}
                />
            </div>
        );
    };
}
