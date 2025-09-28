import type { ActionDefinition } from "@/lib/filezContext/ActionManager";
import { log } from "@/lib/logging";
import { cn } from "@/lib/utils";
import { FilezContext } from "@/main";
import { type CSSProperties, PureComponent } from "react";
import { MdDelete, MdEdit, MdRestartAlt } from "react-icons/md";
import { RiResetLeftFill } from "react-icons/ri";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import KeyComboDisplay from "./KeyComboDisplay";

interface KeyboardShortcutEditorProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

type DialogMode = "edit" | "add";

interface KeyboardShortcutEditorState {
    dialogOpen: boolean;
    dialogMode: DialogMode | null;
    actionId: string | null;
    oldKey: string | null; // Only used for edit mode
    recordingKey: boolean;
    recordedKey: string;
    categoryFilter: string | null;
    error: string | null;
    searchQuery: string;
}

export default class KeyboardShortcutEditor extends PureComponent<
    KeyboardShortcutEditorProps,
    KeyboardShortcutEditorState
> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    constructor(props: KeyboardShortcutEditorProps) {
        super(props);
        this.state = {
            dialogOpen: false,
            dialogMode: null,
            actionId: null,
            oldKey: null,
            recordingKey: false,
            recordedKey: "",
            categoryFilter: null,
            error: null,
            searchQuery: ""
        };
    }

    componentDidMount = async () => {};

    handleStartRecording = (actionId: string, key: string) => {
        this.setState({
            dialogOpen: true,
            dialogMode: "edit",
            actionId: actionId,
            oldKey: key,
            recordingKey: true,
            recordedKey: "",
            error: null
        });
    };

    handleKeyDown = (e: React.KeyboardEvent) => {
        if (!this.state.recordingKey || !this.context) return;

        e.preventDefault();
        e.stopPropagation();

        const keyCombo = this.context.hotkeyManager.formatKeyCombo(e);
        this.setState({ recordedKey: keyCombo });
    };

    handleSaveBinding = () => {
        const { actionId, oldKey, recordedKey, dialogMode } = this.state;
        console.log(
            `handleSaveBinding called: actionId=${actionId}, oldKey=${oldKey}, recordedKey=${recordedKey}, dialogMode=${dialogMode}`
        );
        if (!actionId || !recordedKey || !this.context) return;

        // Don't save if there's a validation error
        if (this.state.error) return;

        try {
            if (dialogMode === "edit") {
                if (!oldKey) return;
                const existingHotkeys = this.context.hotkeyManager
                    .getHotkeysByActionId(actionId)
                    .filter((hk) => {
                        return hk !== oldKey;
                    });
                this.context.hotkeyManager.updateHotkey(actionId, [
                    ...existingHotkeys,
                    recordedKey
                ]);
            } else if (dialogMode === "add") {
                const action = this.context.actionManager.getAction(actionId);
                if (!action) {
                    this.setState({ error: "Action not found" });
                    return;
                }

                const existingHotkeys = this.context.hotkeyManager.getHotkeysByActionId(actionId);
                this.context.hotkeyManager.updateHotkey(actionId, [
                    ...existingHotkeys,
                    recordedKey
                ]);
            }

            this.setState({
                dialogOpen: false,
                dialogMode: null,
                actionId: null,
                oldKey: null,
                recordingKey: false,
                recordedKey: "",
                error: null
            });

            this.forceUpdate();
        } catch (err) {
            this.setState({ error: (err as Error).message });
        }
    };

    handleCancelEdit = () => {
        this.setState({
            dialogOpen: false,
            dialogMode: null,
            actionId: null,
            oldKey: null,
            recordingKey: false,
            recordedKey: "",
            error: null
        });
    };

    handleResetToDefault = (actionId: string) => {
        if (!this.context) return;
        this.context.hotkeyManager.resetActionHotkeysToDefault(actionId);
        this.forceUpdate();
    };

    handleResetAll = () => {
        if (!this.context) return;
        this.context.hotkeyManager.resetAllToDefaults();
        this.forceUpdate();
    };

    handleStartAddingHotkey = (actionId: string) => {
        this.setState({
            dialogOpen: true,
            dialogMode: "add",
            actionId: actionId,
            oldKey: null,
            recordingKey: true,
            recordedKey: "",
            error: null
        });
    };

    handleKeyUp = (event: React.KeyboardEvent) => {
        if (
            !this.state.recordingKey ||
            !this.context ||
            !this.state.recordedKey ||
            !this.state.actionId
        )
            return;

        // Only validate for add mode, not edit mode
        if (this.state.dialogMode !== "add") return;

        // Get the action we're adding a hotkey for
        const action = this.context.actionManager.getAction(this.state.actionId);
        if (!action) return;

        // Check if the key combination is already in use by another action
        const conflictingActionId = this.context.hotkeyManager.getActionByHotkey(
            this.state.recordedKey
        );

        if (conflictingActionId) {
            const conflictingDescription =
                this.context?.t?.actions?.[conflictingActionId] || conflictingActionId;
            const errorTemplate =
                this.context?.t?.keyboardShortcuts?.hotkeyDialog?.keyAlreadyInUse ||
                'Key combination is already used by "{action}"';
            const errorMessage = errorTemplate.replace("{action}", conflictingDescription);
            this.setState({ error: errorMessage });
        } else {
            this.setState({ error: null });
        }
    };

    handleDeleteHotkey = (actionId: string, key: string) => {
        if (!this.context) return;

        const existingHotkeys = this.context.hotkeyManager
            .getHotkeysByActionId(actionId)
            .filter((hk) => {
                return hk !== key;
            });
        this.context.hotkeyManager.updateHotkey(actionId, existingHotkeys);
        this.forceUpdate();
    };

    handleSearchChange = (value: string) => {
        this.setState({ searchQuery: value });
    };

    getCategories = (): string[] => {
        if (!this.context) return [];
        const categories = new Set<string>();
        this.context.actionManager.getAllActions().forEach((def) => {
            categories.add(def.category);
        });
        return Array.from(categories).sort();
    };

    getActionsByCategory = (): Map<string, ActionDefinition[]> => {
        const byCategory = new Map<string, ActionDefinition[]>();
        if (!this.context) return byCategory;

        const searchQuery = this.state.searchQuery.toLowerCase().trim();

        this.context.actionManager.getAllActions().forEach((action) => {
            // Apply search filter if there's a search query
            if (searchQuery) {
                const description = (
                    this.context?.t?.actions?.[action.id] || action.id
                ).toLowerCase();
                const actionId = action.id.toLowerCase();
                const category = action.category.toLowerCase();

                // Get all hotkeys for this action to search their key combinations
                const hotkeys = this.context?.hotkeyManager.getHotkeysByActionId(action.id) || [];
                const keyMatches = hotkeys.some(
                    (hotkey) =>
                        hotkey.toLowerCase().includes(searchQuery) ||
                        (this.context?.hotkeyManager.parseKeyCombo(hotkey) || "")
                            .toLowerCase()
                            .includes(searchQuery)
                );

                // Skip if no matches found
                if (
                    !description.includes(searchQuery) &&
                    !actionId.includes(searchQuery) &&
                    !category.includes(searchQuery) &&
                    !keyMatches
                ) {
                    return;
                }
            }

            const category = action.category;
            if (!byCategory.has(category)) {
                byCategory.set(category, []);
            }
            byCategory.get(category)!.push(action);
        });

        byCategory.forEach((actions) => {
            actions.sort((a, b) => {
                const aDesc = this.context?.t?.actions?.[a.id] || a.id;
                const bDesc = this.context?.t?.actions?.[b.id] || b.id;
                return aDesc.localeCompare(bDesc);
            });
        });

        log.debug("Actions by category:", byCategory);

        return byCategory;
    };

    render = () => {
        const actionsByCategory = this.getActionsByCategory();
        const categories = Array.from(actionsByCategory.keys()).sort();

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    `KeyboardShortcutEditor flex w-full min-w-0 flex-col gap-4 select-none`,
                    this.props.className
                )}
            >
                <div className="mb-4 space-y-2">
                    <div className="flex items-center justify-between gap-4">
                        <div className="max-w-sm flex-1">
                            <Input
                                placeholder="Search actions..."
                                value={this.state.searchQuery}
                                onChange={(e) => this.handleSearchChange(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <Button variant="outline" onClick={this.handleResetAll}>
                            <MdRestartAlt className="h-4 w-4" />
                            {this.context?.t.keyboardShortcuts.resetAll}
                        </Button>
                    </div>
                </div>

                <div className="space-y-6">
                    {categories.length === 0 && this.state.searchQuery ? (
                        <div className="text-muted-foreground py-8 text-center">
                            <p>No actions found matching "{this.state.searchQuery}"</p>
                        </div>
                    ) : (
                        categories.map((category) => (
                            <div key={category} className="space-y-2">
                                <h3 className="text-muted-foreground text-lg font-semibold">
                                    {category}
                                </h3>
                                <div className="space-y-3">
                                    {actionsByCategory.get(category)!.map((action) => {
                                        const hotkeys =
                                            this.context?.hotkeyManager.getHotkeysByActionId(
                                                action.id
                                            ) || [];

                                        const description =
                                            this.context?.t?.actions?.[action.id] || action.id;

                                        return (
                                            <div
                                                key={action.id}
                                                className="space-y-2 rounded-lg border p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-sm font-medium">
                                                        {description}
                                                    </h4>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            this.handleStartAddingHotkey(action.id)
                                                        }
                                                        className="text-xs"
                                                    >
                                                        + Add Hotkey
                                                    </Button>
                                                </div>
                                                <div className="space-y-1">
                                                    {hotkeys.map((hotkey) => {
                                                        return (
                                                            <div
                                                                key={hotkey}
                                                                className="flex min-w-0 items-center justify-between gap-4 pl-4"
                                                            >
                                                                <div className="flex w-full items-center justify-between">
                                                                    <KeyComboDisplay
                                                                        keyCombo={hotkey}
                                                                    />
                                                                    <div className="flex items-center">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() =>
                                                                                this.handleStartRecording(
                                                                                    action.id,
                                                                                    hotkey
                                                                                )
                                                                            }
                                                                            title={
                                                                                this.context?.t
                                                                                    .keyboardShortcuts
                                                                                    .edit
                                                                            }
                                                                        >
                                                                            <MdEdit className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() =>
                                                                                this.handleResetToDefault(
                                                                                    action.id
                                                                                )
                                                                            }
                                                                            title={
                                                                                this.context?.t
                                                                                    .keyboardShortcuts
                                                                                    .reset
                                                                            }
                                                                        >
                                                                            <RiResetLeftFill className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            onClick={() =>
                                                                                this.handleDeleteHotkey(
                                                                                    action.id,
                                                                                    hotkey
                                                                                )
                                                                            }
                                                                            title="Delete hotkey"
                                                                            className="hover:text-destructive"
                                                                        >
                                                                            <MdDelete className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <Dialog
                    open={this.state.dialogOpen}
                    onOpenChange={(open) => {
                        if (!open) {
                            this.handleCancelEdit();
                        }
                    }}
                >
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {this.state.dialogMode === "edit"
                                    ? this.context?.t?.keyboardShortcuts?.hotkeyDialog?.editTitle ||
                                      "Edit Keyboard Shortcut"
                                    : this.context?.t?.keyboardShortcuts?.hotkeyDialog?.addTitle ||
                                      "Add New Hotkey"}
                            </DialogTitle>
                            <DialogDescription>
                                {this.state.dialogMode === "edit"
                                    ? this.context?.t?.keyboardShortcuts?.hotkeyDialog
                                          ?.editDescription ||
                                      "Press the key combination you want to use for this action."
                                    : `${this.context?.t?.keyboardShortcuts?.hotkeyDialog?.addDescription || "Add a new hotkey for"} "${
                                          this.state.actionId
                                              ? this.context?.t?.actions?.[this.state.actionId] ||
                                                this.state.actionId
                                              : ""
                                      }"`}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div
                                className="border-input flex min-h-10 w-full cursor-text items-center gap-2 rounded-md border bg-transparent px-3 py-2"
                                onClick={(e) =>
                                    (e.target as HTMLElement).querySelector("input")?.focus()
                                }
                            >
                                {this.state.recordedKey ? (
                                    <KeyComboDisplay
                                        keyCombo={
                                            this.context?.hotkeyManager.parseKeyCombo(
                                                this.state.recordedKey
                                            ) || this.state.recordedKey
                                        }
                                    />
                                ) : (
                                    <span className="text-muted-foreground">
                                        {this.context?.t?.keyboardShortcuts?.hotkeyDialog
                                            ?.pressKeys || "Press keys..."}
                                    </span>
                                )}
                                <input
                                    className="sr-only"
                                    onKeyDown={this.handleKeyDown}
                                    onKeyUp={this.handleKeyUp}
                                    autoFocus
                                />
                            </div>
                            {this.state.error && (
                                <p className="text-destructive text-sm">{this.state.error}</p>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={this.handleCancelEdit}>
                                    {this.context?.t?.keyboardShortcuts?.hotkeyDialog?.cancel ||
                                        "Cancel"}
                                </Button>
                                <Button
                                    onClick={this.handleSaveBinding}
                                    disabled={!this.state.recordedKey || !!this.state.error}
                                >
                                    {this.state.dialogMode === "edit"
                                        ? this.context?.t?.keyboardShortcuts?.hotkeyDialog?.save ||
                                          "Save"
                                        : this.context?.t?.keyboardShortcuts?.hotkeyDialog
                                              ?.addHotkey || "Add Hotkey"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    };
}
