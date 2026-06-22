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
import CodeThemePicker from "@/components/code/codeThemePicker/CodeThemePicker";
import HistoryPanel from "@/components/appShell/historyPanel/HistoryPanel";
import KeyboardShortcuts from "@/components/actions/keyboardShortcutEditor/KeyboardShortcutEditor";
import LanguagePicker from "@/components/settings/languagePicker/LanguagePicker";
import SettingsPanel from "@/components/settings/settingsPanel/SettingsPanel";
import ThemePicker from "@/components/settings/themePicker/ThemePicker";

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
        },
        [CoreModalTypes.codeThemeSelector]: {
            component: () => (
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.codeThemePicker.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <CodeThemePicker className={`overflow-y-auto px-6 pb-6`} standalone />
                </DialogContent>
            )
        },
        [CoreModalTypes.settings]: {
            component: () => (
                // Wider modal + flush inner panel: drop DialogContent's
                // default `p-6` outer padding and the gap between header
                // and body so the SettingsPanel reaches the modal edges.
                // The header keeps its own padding via a wrapper so the
                // title doesn't sit against the border.
                <DialogContent
                    className={`sm:max-w-5xl max-h-[85vh] !p-0 gap-0 overflow-hidden`}
                >
                    <DialogHeader className={`px-6 pt-6`}>
                        <DialogTitle>{this.context?.t.settings.title}</DialogTitle>
                        <DialogDescription>
                            {this.context?.t.settings.description}
                        </DialogDescription>
                    </DialogHeader>
                    <SettingsPanel
                        className={`min-h-0 flex-1 overflow-y-auto px-6 pb-6`}
                    />
                </DialogContent>
            )
        },
        [CoreModalTypes.history]: {
            component: () => (
                <DialogContent
                    className={`sm:max-w-3xl max-h-[85vh] !p-0 gap-0 overflow-hidden`}
                >
                    <DialogHeader className={`px-6 pt-6`}>
                        <DialogTitle>{this.context?.t.historyPanel.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <HistoryPanel className={`min-h-0 flex-1 overflow-y-auto`} />
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
