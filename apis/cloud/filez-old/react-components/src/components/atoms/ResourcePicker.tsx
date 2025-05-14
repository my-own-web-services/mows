import React, { ComponentType, PureComponent } from "react";
import MultiItemTagPicker, {
    MultiItemTagPickerResources,
    TagData,
    resourcesToSelectionMap
} from "./MultiItemTagPicker";
import { FilezContext } from "../../FilezProvider";
import { IconButton, InputPicker, Modal, TagPicker } from "rsuite";
import { BiPlus } from "react-icons/bi";
import { BaseResource } from "../list/resource/ResourceListTypes";
import { match } from "ts-pattern";
import { RsuiteComponentSize } from "../../types";

interface ResourcePickerProps<Resource extends BaseResource> {
    readonly getKnownTagsFunction: () => Promise<TagData[]>;
    readonly mode: "single" | "multi" | "multimulti" | "singlemulti";
    readonly initialSingleSelectedValue?: string;
    readonly initialMultiSelectedValues?: string[];
    readonly multimultiResources?: Resource[];
    readonly singleMultiResources?: Resource[];
    readonly singleMultiSelectField?: string;
    readonly multimultiSelectField?: string;
    readonly resourceType: string;

    readonly createResourceComponent?: ComponentType;
    readonly createComponentProps?: Record<string, any>;
    readonly creatable?: boolean;
    /**
     * @default "md"
     */
    readonly size?: RsuiteComponentSize;
    readonly disabled?: boolean;
    readonly style?: React.CSSProperties;

    /**
     * Called when the user changes the selection of resources
     */
    readonly onSingleSelect?: (selectedResourceId: string) => void;
    readonly onSingleMultiSelect?: (
        selectedResourceId: string,
        selectedResourceIds: string[]
    ) => void;
    readonly onMultiChange?: (selectedResourceIds: string[]) => void;
    readonly onMultiMultiChange?: (
        resources: MultiItemTagPickerResources
    ) => void;
}

interface ResourcePickerState {
    readonly knownTags: TagData[];
    readonly knownTagsLoaded: boolean;
    readonly resourceMap: MultiItemTagPickerResources;
    readonly singleSelectedValue?: string;
    readonly multiSelectedValues?: string[];
    readonly createModalOpen?: boolean;
    readonly singleMultiSelectedValue?: string;
}

export default class ResourcePicker<
    Resource extends BaseResource
> extends PureComponent<ResourcePickerProps<Resource>, ResourcePickerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;
    constructor(props: ResourcePickerProps<Resource>) {
        super(props);
        this.state = {
            resourceMap: {},
            knownTagsLoaded: false,
            knownTags: [],
            singleSelectedValue: props.initialSingleSelectedValue,
            multiSelectedValues: props.initialMultiSelectedValues
        };
    }

    componentDidMount = async () => {
        await this.loadAndSetKnownTags();
    };

    loadAndSetKnownTags = async () => {
        const knownTags = await this.props.getKnownTagsFunction();
        this.setState({ knownTags, knownTagsLoaded: true });
    };

    onMultiMultiChange = (resources: MultiItemTagPickerResources) => {
        this.props.onMultiMultiChange?.(resources);
    };

    onSingleSelect = (selectedUserId: string) => {
        this.setState({ singleSelectedValue: selectedUserId });
        this.props.onSingleSelect?.(selectedUserId);
    };

    onMultiChange = (selectedUserIds: string[]) => {
        this.setState({ multiSelectedValues: selectedUserIds });
        this.props.onMultiChange?.(selectedUserIds);
    };

    openCreateModal = () => {
        this.setState({ createModalOpen: true });
    };

    onResourceCreated = async (id: string) => {
        await this.loadAndSetKnownTags();
        this.setState({ createModalOpen: false });
    };

    onAbortCreate = () => {
        this.setState({ createModalOpen: false });
    };

    onSingleMultiSelect = (selectedResourceIds: string) => {
        this.setState({ singleMultiSelectedValue: selectedResourceIds });

        const resources = this.props.singleMultiResources?.map((r) => r._id);
        if (resources === undefined) {
            throw new Error(
                "singleMultiSelectField must be defined when mode is singlemulti"
            );
        }
        this.props.onSingleMultiSelect?.(selectedResourceIds, resources);
    };

    render = () => {
        const creatable =
            this.props.createResourceComponent !== undefined &&
            this.props.creatable !== false;
        const createButtonWidth = 35;
        const pickerWidth = creatable
            ? `calc(100% - ${createButtonWidth}px)`
            : "100%";

        const pickerStyle = {
            width: pickerWidth,
            display: "inline-block"
        };
        return (
            <div className="ResourcePicker" style={{ ...this.props.style }}>
                {match(this.props.mode)
                    .with("single", () => (
                        <InputPicker
                            style={pickerStyle}
                            size={this.props.size ?? "md"}
                            disabled={this.props.disabled}
                            data={this.state.knownTags}
                            onSelect={this.onSingleSelect}
                            value={this.state.singleSelectedValue}
                            block
                        />
                    ))
                    .with("singlemulti", () => (
                        <InputPicker
                            style={pickerStyle}
                            size={this.props.size ?? "md"}
                            disabled={this.props.disabled}
                            data={this.state.knownTags}
                            onSelect={this.onSingleMultiSelect}
                            placeholder="Mixed Values"
                            value={resourcesToSelection(
                                //@ts-ignore
                                this.props.singleMultiResources ?? [],
                                this.props.singleMultiSelectField
                            )}
                            block
                        />
                    ))
                    .with("multi", () => (
                        <TagPicker
                            style={pickerStyle}
                            data={this.state.knownTags}
                            size={this.props.size ?? "md"}
                            onChange={this.onMultiChange}
                            value={this.state.multiSelectedValues}
                            block
                        />
                    ))
                    .with("multimulti", () => {
                        if (this.props.multimultiSelectField === undefined) {
                            throw new Error(
                                "multimultiSelectField must be defined when mode is multimulti"
                            );
                        }
                        return (
                            <MultiItemTagPicker
                                style={pickerStyle}
                                size={this.props.size ?? "md"}
                                possibleTags={this.state.knownTags}
                                onChange={this.onMultiMultiChange}
                                creatable={false}
                                multiItemSelectedTags={resourcesToSelectionMap(
                                    //@ts-ignore
                                    this.props.multimultiResources ?? [],
                                    this.props.multimultiSelectField
                                )}
                            />
                        );
                    })
                    .exhaustive()}
                {creatable && (
                    <>
                        <IconButton
                            style={{
                                width: createButtonWidth,
                                display: "inline-block"
                            }}
                            size={this.props.size ?? "md"}
                            icon={
                                <BiPlus style={{ transform: "scale(1.3)" }} />
                            }
                            onClick={this.openCreateModal}
                        />

                        <Modal
                            onClose={this.onAbortCreate}
                            open={this.state.createModalOpen}
                        >
                            <Modal.Header>
                                <Modal.Title>
                                    Create {this.props.resourceType}
                                </Modal.Title>
                            </Modal.Header>
                            <Modal.Body>
                                {React.createElement(
                                    this.props.createResourceComponent,
                                    {
                                        ...this.props.createComponentProps,
                                        // @ts-ignore
                                        onCreateResourceSuccess:
                                            this.onResourceCreated,
                                        onCreateResourceAbort:
                                            this.onAbortCreate,
                                        creatable: true
                                    }
                                )}
                            </Modal.Body>
                        </Modal>
                    </>
                )}
            </div>
        );
    };
}

const resourcesToSelection = <Resource extends BaseResource>(
    resources: Resource[],
    field?: string
) => {
    if (field === undefined) {
        throw new Error("field must be defined");
    }
    const firstResourceValue = (() => {
        for (const resource of resources) {
            if (typeof resource[field] === "string") {
                return resource[field] as string;
            }
        }
    })();
    if (firstResourceValue === undefined) {
        return undefined;
    }

    if (resources.every((r) => r[field] === firstResourceValue)) {
        return firstResourceValue;
    } else {
        return undefined;
    }
};
