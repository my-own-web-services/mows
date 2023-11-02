import { PureComponent } from "react";

interface StoragePickerProps {}

interface StoragePickerState {
    readonly selectedStorageId?: string;
    readonly availableStorages?: string[];
}

export default class StoragePicker extends PureComponent<StoragePickerProps, StoragePickerState> {
    constructor(props: StoragePickerProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        return <div className="StoragePicker"></div>;
    };
}
