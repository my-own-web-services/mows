import { FilezClient } from "@firstdorsal/filez-client";
import { ReactElement, createRef } from "react";
import ResourceList, { BaseResource } from "./ResourceList";
import { Button, Modal } from "rsuite";
import { EditResource } from "../../../types";

export interface FilezMenuItems<ResourceType> {
    name: string;
    resources?: string[];
    onClick?: (items: ResourceType[]) => void;
    render?: (props: FilezMenuItemsRenderProps<ResourceType>) => JSX.Element;
}

export interface FilezMenuItemsRenderProps<ResourceType> {
    items: ResourceType[];
    resourceType: string;
    handleClose: () => void;
    editResource?: ReactElement<any, any>;
    filezClient?: FilezClient;
    refreshList?: InstanceType<typeof ResourceList>["refreshList"];
}

export const defaultMenuItems: FilezMenuItems<BaseResource>[] = [
    {
        name: "Log to console",
        onClick: (items: BaseResource[]) => {
            // TODO this does not log multiple elements as it should
            if (items.length === 1) {
                console.log(items[0]);
            } else {
                console.log(items);
            }
        }
    },
    {
        name: "Delete",
        resources: ["Permission", "File", "FileGroup", "UserGroup"],
        render: ({
            items,
            resourceType,
            handleClose,
            filezClient,
            refreshList
        }: FilezMenuItemsRenderProps<BaseResource>) => {
            if (items.length === 0 || !filezClient) return <></>;
            const multiple = items.length > 1;
            const single = items.length === 1;

            // @ts-ignore
            const name = items?.[0].name ?? items[0]._id;

            return (
                <Modal open={true} onClose={handleClose}>
                    <Modal.Header>
                        <Modal.Title>
                            Delete {multiple && ` ${items.length} `}
                            {resourceType}
                            {single && ` ${name}`}
                            {multiple && "s"}? This cannot be undone.
                        </Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Button
                            color="red"
                            style={{ marginRight: "10px" }}
                            appearance="primary"
                            onClick={async () => {
                                const promises = items.map(item => {
                                    return match(resourceType)
                                        .with("Permission", () => {
                                            return filezClient.delete_permission(item._id);
                                        })
                                        .with("File", () => {
                                            return filezClient.delete_file(item._id);
                                        })
                                        .with("FileGroup", () => {
                                            return filezClient.delete_file_group(item._id);
                                        })
                                        .with("UserGroup", () => {
                                            return filezClient.delete_user_group(item._id);
                                        })
                                        .otherwise(() => {
                                            throw new Error(
                                                `Resource type ${resourceType} is not supported`
                                            );
                                        });
                                });
                                const res = await Promise.all(promises);

                                if (res) {
                                    await refreshList?.();
                                    handleClose();
                                }
                            }}
                        >
                            Delete
                        </Button>

                        <Button onClick={handleClose}>Cancel</Button>
                    </Modal.Body>
                </Modal>
            );
        }
    },
    {
        name: "Edit",
        resources: ["Permission", "File", "FileGroup", "UserGroup"],
        render: ({
            items,
            resourceType,
            handleClose,
            editResource,
            refreshList
        }: FilezMenuItemsRenderProps<BaseResource>) => {
            if (!editResource) return <></>;
            const editResourceRef: React.RefObject<EditResource> = createRef();
            return (
                <Modal open={true} onClose={handleClose}>
                    <Modal.Header>
                        <Modal.Title>Edit {resourceType}</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        {cloneElement(editResource, {
                            ref: editResourceRef,
                            resourceIds: items.map(item => item._id)
                        })}
                        <br />
                        <Button
                            onClick={async () => {
                                if (!editResourceRef.current) return;
                                const res = await editResourceRef.current.update();
                                if (res) {
                                    await refreshList?.();
                                    handleClose();
                                }
                            }}
                            style={{ marginRight: "10px" }}
                            appearance="primary"
                        >
                            Update
                        </Button>

                        <Button onClick={handleClose}>Cancel</Button>
                    </Modal.Body>
                </Modal>
            );
        }
    }
];
