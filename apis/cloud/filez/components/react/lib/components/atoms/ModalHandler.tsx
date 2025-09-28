import { cn } from "@/lib/utils";
import { FilezContext, ModalType } from "@/main";
import { PureComponent, type CSSProperties, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import KeyboardShortcuts from "./KeyboardShortcutEditor";
import LanguagePicker from "./LanguagePicker";
import ThemePicker from "./ThemePicker";

interface ModalHandlerProps {
    readonly className?: string;
    readonly style?: CSSProperties;
}

interface ModalHandlerState {}

export default class ModalHandler extends PureComponent<ModalHandlerProps, ModalHandlerState> {
    static contextType = FilezContext;
    declare context: React.ContextType<typeof FilezContext>;

    modals: Record<ModalType, { component: () => ReactNode }> = {
        keyboardShortcutEditor: {
            component: () => (
                <DialogContent className="max-h-[90vh] max-w-4xl w-full overflow-y-auto select-none">
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.keyboardShortcuts.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <KeyboardShortcuts />
                </DialogContent>
            )
        },
        themeSelector: {
            component: () => (
                <DialogContent className="max-h-[90vh] overflow-y-auto select-none">
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.themePicker.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <ThemePicker standalone />
                </DialogContent>
            )
        },
        languageSelector: {
            component: () => (
                <DialogContent className="max-h-[90vh] overflow-y-auto select-none">
                    <DialogHeader>
                        <DialogTitle>{this.context?.t.languagePicker.title}</DialogTitle>
                        <DialogDescription aria-describedby={undefined} />
                    </DialogHeader>
                    <LanguagePicker standalone />
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
                className={cn(`ModalHandler`, this.props.className)}
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
