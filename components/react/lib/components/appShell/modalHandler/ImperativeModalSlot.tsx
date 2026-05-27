import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MowsContext } from "@/lib/mowsContext/MowsContext";
import {
    resolveCurrentImperativeRequest,
    type ImperativeRequest
} from "./imperativeRequests";

interface ImperativeModalSlotProps {
    readonly request: ImperativeRequest;
}

type AlertSeverity = NonNullable<Extract<ImperativeRequest, { kind: "alert" }>["severity"]>;

const severityIcon = (severity: AlertSeverity) => {
    switch (severity) {
        case `warning`:
            return <AlertTriangle className={`text-amber-500 shrink-0`} aria-hidden />;
        case `error`:
            return <XCircle className={`text-destructive shrink-0`} aria-hidden />;
        case `success`:
            return <CheckCircle2 className={`text-emerald-500 shrink-0`} aria-hidden />;
        default:
            return <Info className={`text-muted-foreground shrink-0`} aria-hidden />;
    }
};

/** Renders whichever imperative request is currently active. The slot lives
 *  inside <ModalHandler/> and is keyed externally so each new request resets
 *  the internal prompt/validation state. */
const ImperativeModalSlot = ({ request }: ImperativeModalSlotProps) => {
    const ctx = useContext(MowsContext);
    const t = ctx?.t.modalHandler.imperative;
    const confirmLabel =
        (request.kind !== `alert` && request.confirmLabel) || t?.confirmDefault || `Confirm`;
    const cancelLabel =
        (request.kind !== `alert` && request.cancelLabel) || t?.cancelDefault || `Cancel`;
    const dismissLabel =
        (request.kind === `alert` && request.dismissLabel) || t?.dismissDefault || `OK`;

    const [promptValue, setPromptValue] = useState<string>(
        request.kind === `prompt` ? request.initial ?? `` : ``
    );
    const validationError = useMemo<string | null>(() => {
        if (request.kind !== `prompt`) return null;
        if (!request.validate) return null;
        return request.validate(promptValue);
    }, [request, promptValue]);

    const inputRef = useRef<HTMLInputElement | null>(null);
    useEffect(() => {
        if (request.kind === `prompt`) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [request]);

    const onCancel = () => {
        if (request.kind === `confirm`) resolveCurrentImperativeRequest(false);
        else if (request.kind === `prompt`) resolveCurrentImperativeRequest(null);
        else resolveCurrentImperativeRequest(undefined);
    };

    const onConfirm = () => {
        if (request.kind === `confirm`) resolveCurrentImperativeRequest(true);
        else if (request.kind === `prompt`) {
            if (validationError !== null) return;
            resolveCurrentImperativeRequest(promptValue);
        } else resolveCurrentImperativeRequest(undefined);
    };

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onCancel();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {request.kind === `alert` ? (
                            <span className={`flex items-center gap-2`}>
                                {severityIcon(request.severity ?? `info`)}
                                {request.title}
                            </span>
                        ) : (
                            request.title
                        )}
                    </DialogTitle>
                    {request.description ? (
                        <DialogDescription className={`whitespace-pre-line`}>
                            {request.description}
                        </DialogDescription>
                    ) : (
                        <DialogDescription aria-describedby={undefined} />
                    )}
                </DialogHeader>

                {request.kind === `prompt` && (
                    <div className={`flex flex-col gap-1.5`}>
                        <Input
                            ref={inputRef}
                            value={promptValue}
                            placeholder={request.placeholder}
                            onChange={(e) => setPromptValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === `Enter`) {
                                    e.preventDefault();
                                    onConfirm();
                                }
                            }}
                            aria-invalid={validationError !== null || undefined}
                        />
                        {validationError !== null && (
                            <p className={`text-destructive text-sm`} role={`alert`}>
                                {validationError || t?.validationFallback || `Invalid value`}
                            </p>
                        )}
                    </div>
                )}

                <DialogFooter>
                    {request.kind !== `alert` && (
                        <Button variant={`ghost`} onClick={onCancel}>
                            {cancelLabel}
                        </Button>
                    )}
                    <Button
                        variant={
                            request.kind === `confirm` && request.danger
                                ? `destructive`
                                : `default`
                        }
                        disabled={request.kind === `prompt` && validationError !== null}
                        onClick={onConfirm}
                    >
                        {request.kind === `alert` ? dismissLabel : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ImperativeModalSlot;
