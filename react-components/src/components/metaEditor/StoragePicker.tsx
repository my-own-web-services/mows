import { PureComponent } from "react";
import { FilezContext } from "../../FilezProvider";
import { InputPicker } from "rsuite";
import { UsageLimits } from "@firstdorsal/filez-client/dist/js/apiTypes/UsageLimits";
import { bytesToHumanReadableSize } from "../../utils";

interface StoragePickerProps {
    readonly onChange?: (storage_id: string) => void;
    readonly disabled?: boolean;
}

interface StoragePickerState {
    readonly selectedStorageId: string | null;
    readonly availableStorages: StorageOptions[] | null;
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
            availableStorages: null
        };
    }

    componentDidMount = async () => {
        await this.getUserStorageLimits();
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

    render = () => {
        if (this.state.availableStorages === null) return;
        return (
            <div className="StoragePicker">
                <label className={this.props.disabled ? "disabled" : ""}>Storage</label>
                <br />
                <InputPicker
                    disabled={this.props.disabled}
                    data={this.state.availableStorages.map(storageOption => {
                        const label = `${storageOption.storage_id} (${bytesToHumanReadableSize(
                            storageOption.limits.used_storage
                        )} / ${bytesToHumanReadableSize(storageOption.limits.max_storage)} used)`;
                        return { label, value: storageOption.storage_id };
                    })}
                    value={this.state.selectedStorageId}
                    onChange={value => this.setState({ selectedStorageId: value })}
                />
            </div>
        );
    };
}
