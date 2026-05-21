// Mounts the supervisor's confirm/prompt modal. Subscribes to the singleton
// in lib/modals.ts; whichever request is currently active is rendered as a
// <Dialog>. Dismissing (close/cancel/Esc) resolves the promise with a "no"
// answer; pressing the confirm button resolves with "yes" / the input value.

import { Button } from "mows-components-react/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "mows-components-react/components/ui/dialog";
import NumberInput from "mows-components-react/components/input/numberInput/NumberInput";
import { Input } from "mows-components-react/components/ui/input";
import { Label } from "mows-components-react/components/ui/label";
import {
    RadioGroup,
    RadioGroupItem
} from "mows-components-react/components/ui/radio-group";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "mows-components-react/components/ui/select";
import { useEffect, useState } from "react";
import { getVmDefaults } from "../lib/api";
import {
    getCurrentModal,
    subscribeModal,
    type ModalRequest,
    type VmCreateInput,
    type VmDisplayModeChoice,
    type VmImageChoice
} from "../lib/modals";

const ModalHost = () => {
    const [req, setReq] = useState<ModalRequest | null>(getCurrentModal());
    useEffect(() => subscribeModal(setReq), []);

    // Re-seed the prompt input each time a new prompt request arrives.
    const [promptValue, setPromptValue] = useState("");
    const [vmForm, setVmForm] = useState<VmCreateInput>({
        name: "",
        cwd: "",
        cpus: null,
        memoryMb: null,
        image: "alpine",
        displayMode: "headless"
    });
    useEffect(() => {
        if (!req) return;
        if (req.kind === "prompt") setPromptValue(req.initial);
        if (req.kind === "vm-create") {
            setVmForm(req.initial);
            // Fetch the supervisor's current defaults and pre-fill any
            // numeric field the caller didn't seed, so the user sees the
            // actual values they'll get and can tweak from there.
            getVmDefaults()
                .then((defaults) => {
                    setVmForm((prev) => ({
                        ...prev,
                        cpus: prev.cpus ?? defaults.cpus,
                        memoryMb: prev.memoryMb ?? defaults.memory_mb
                    }));
                })
                .catch(() => {
                    /* leave fields empty — backend applies its own default */
                });
        }
    }, [req]);

    if (!req) return null;

    const cancel = () => {
        if (req.kind === "confirm") req.resolve(false);
        else req.resolve(null);
    };

    const confirm = () => {
        if (req.kind === "confirm") req.resolve(true);
        else if (req.kind === "prompt") req.resolve(promptValue);
        else req.resolve(vmForm);
    };

    return (
        <Dialog
            open
            onOpenChange={(open: boolean) => {
                if (!open) cancel();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{req.title}</DialogTitle>
                    {("description" in req ? req.description : null) && (
                        <DialogDescription className="whitespace-pre-line">
                            {req.kind === "confirm" ? req.description : req.description}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {req.kind === "prompt" && (
                    <Input
                        autoFocus
                        value={promptValue}
                        placeholder={req.placeholder}
                        onChange={(e) => setPromptValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                confirm();
                            }
                        }}
                    />
                )}

                {req.kind === "vm-create" && (
                    <form
                        className="flex flex-col gap-3"
                        onSubmit={(e) => {
                            e.preventDefault();
                            confirm();
                        }}
                    >
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="vm-name">Name (optional)</Label>
                            <Input
                                id="vm-name"
                                autoFocus
                                placeholder="leave empty for random adjective-noun"
                                value={vmForm.name}
                                onChange={(e) =>
                                    setVmForm({ ...vmForm, name: e.target.value })
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="vm-cwd">Workspace path (optional)</Label>
                            <Input
                                id="vm-cwd"
                                placeholder="/home/you/project"
                                value={vmForm.cwd}
                                onChange={(e) =>
                                    setVmForm({ ...vmForm, cwd: e.target.value })
                                }
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="vm-image">Base image</Label>
                                <Select
                                    value={vmForm.image}
                                    onValueChange={(image: VmImageChoice) =>
                                        setVmForm({ ...vmForm, image })
                                    }
                                >
                                    <SelectTrigger id="vm-image">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="alpine">Alpine</SelectItem>
                                        <SelectItem value="debian">Debian</SelectItem>
                                        <SelectItem value="ubuntu">Ubuntu</SelectItem>
                                        <SelectItem value="nixos">NixOS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Display</Label>
                                <RadioGroup
                                    value={vmForm.displayMode}
                                    onValueChange={(
                                        displayMode: VmDisplayModeChoice
                                    ) =>
                                        setVmForm({ ...vmForm, displayMode })
                                    }
                                    className="flex h-9 items-center gap-4"
                                >
                                    <Label
                                        htmlFor="vm-headless"
                                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                                    >
                                        <RadioGroupItem
                                            id="vm-headless"
                                            value="headless"
                                        />
                                        Headless
                                    </Label>
                                    <Label
                                        htmlFor="vm-desktop"
                                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                                    >
                                        <RadioGroupItem
                                            id="vm-desktop"
                                            value="desktop"
                                        />
                                        Desktop
                                    </Label>
                                </RadioGroup>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="vm-cpus">CPUs</Label>
                                <NumberInput
                                    id="vm-cpus"
                                    min={1}
                                    value={vmForm.cpus}
                                    onChange={(cpus) =>
                                        setVmForm({ ...vmForm, cpus })
                                    }
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="vm-mem">Memory (MB)</Label>
                                <NumberInput
                                    id="vm-mem"
                                    min={64}
                                    step={64}
                                    value={vmForm.memoryMb}
                                    onChange={(memoryMb) =>
                                        setVmForm({ ...vmForm, memoryMb })
                                    }
                                />
                            </div>
                        </div>
                        {/* Hidden submit so Enter inside any field submits the form.
                            Library Button enforces the no-raw-controls rule and
                            still acts as the form's implicit submit when type="submit". */}
                        <Button type="submit" variant="ghost" className="sr-only">
                            submit
                        </Button>
                    </form>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={cancel}>
                        {req.cancelLabel}
                    </Button>
                    <Button
                        variant={
                            req.kind === "confirm" && req.danger
                                ? "destructive"
                                : "default"
                        }
                        onClick={confirm}
                    >
                        {req.confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ModalHost;
