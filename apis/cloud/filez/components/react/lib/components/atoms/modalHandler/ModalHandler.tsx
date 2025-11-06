import { FilezContext, type ModalType } from "@/lib/filezContext/FilezContext";
import { cn } from "@/lib/utils";
import { PureComponent, type CSSProperties, type ReactNode } from "react";
import DevPanel from "../../development/DevPanel";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "../../ui/dialog";
import FileGroupCreate from "../fileGroupCreate/FileGroupCreate";
import KeyboardShortcuts from "../keyboardShortcutEditor/KeyboardShortcutEditor";
import LanguagePicker from "../languagePicker/LanguagePicker";
import ThemePicker from "../themePicker/ThemePicker";

interface ModalHandlerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

type ModalHandlerState = Record<string, never>;

export default class ModalHandler extends PureComponent<ModalHandlerProps, ModalHandlerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    modals: Record<ModalType, { component: () => ReactNode }> = {
        keyboardShortcutEditor: {
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
        themeSelector: {
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
        languageSelector: {
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
        fileGroupCreate: {
            component: () => (
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.fileGroupCreate.title}</DialogTitle>
                        <DialogDescription>
                            {this.context?.t.fileGroupCreate.description}
                        </DialogDescription>
                    </DialogHeader>
                    <FileGroupCreate
                        className={`overflow-y-auto px-6 pb-6`}
                        onCancel={() => this.context?.changeActiveModal(undefined)}
                        onFileGroupCreated={() => this.context?.changeActiveModal(undefined)}
                    />
                </DialogContent>
            )
        },
        devTools: {
            component: () => (
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.devTools.title}</DialogTitle>
                        <DialogDescription>
                            {this.context?.t.devTools.description}
                        </DialogDescription>
                    </DialogHeader>
                    <DevPanel className={`overflow-y-auto select-none`} />
                </DialogContent>
            )
        }
    };

    constructor(props: ModalHandlerProps) {
        super(props);
        this.state = {};
    }

    componentDidMount = async () => {};

    render = () => {
        if (!this.context?.currentlyOpenModal) return null;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(`ModalHandler w-full`, this.props.className)}
            >
                <Dialog
                    open={true}
                    onOpenChange={(open) => !open && this.context?.changeActiveModal(undefined)}
                >
                    {this.modals[this.context?.currentlyOpenModal]?.component()}
                </Dialog>
            </div>
        );
    };
}
