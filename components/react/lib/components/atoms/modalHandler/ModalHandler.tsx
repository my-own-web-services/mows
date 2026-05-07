import { MowsContext } from "@/lib/mowsContext/MowsContext";
import { CoreModalTypes } from "@/lib/mowsContext/coreActions";
import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties, type ReactNode } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import KeyboardShortcuts from "../keyboardShortcutEditor/KeyboardShortcutEditor";
import LanguagePicker from "../languagePicker/LanguagePicker";
import ThemePicker from "../themePicker/ThemePicker";

export interface ModalEntry {
    component: () => ReactNode;
}

interface ModalHandlerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly extraModals?: Record<string, ModalEntry>;
}

type ModalHandlerState = Record<string, never>;

export default class ModalHandler extends PureComponent<ModalHandlerProps, ModalHandlerState> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    coreModals: Record<string, ModalEntry> = {
        [CoreModalTypes.keyboardShortcutEditor]: {
            component: () => (
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.keyboardShortcuts.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <KeyboardShortcuts className={`overflow-y-auto p-6`} />
                </DialogContent>
            )
        },
        [CoreModalTypes.themeSelector]: {
            component: () => (
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.themePicker.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <ThemePicker className={`overflow-y-auto px-6 pb-6`} standalone />
                </DialogContent>
            )
        },
        [CoreModalTypes.languageSelector]: {
            component: () => (
                <DialogContent className={`max-h-52`}>
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.languagePicker.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <LanguagePicker className={`overflow-y-auto px-6 pb-6`} standalone />
                </DialogContent>
            )
        }
    };

    constructor(props: ModalHandlerProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        if (!this.context?.currentlyOpenModal) return null;

        const allModals = { ...this.coreModals, ...(this.props.extraModals ?? {}) };
        const entry = allModals[this.context.currentlyOpenModal];
        if (!entry) return null;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ModalHandler w-full`, this.props.className)}
            >
                <Dialog
                    open={true}
                    onOpenChange={(open) => !open && this.context?.changeActiveModal(undefined)}
                >
                    {entry.component()}
                </Dialog>
            </div>
        );
    };
}
