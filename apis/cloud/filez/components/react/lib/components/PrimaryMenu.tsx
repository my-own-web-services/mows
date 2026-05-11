import PrimaryMenu, {
    type PrimaryMenuProps as MowsPrimaryMenuProps
} from "mows-components-react/components/atoms/primaryMenu/PrimaryMenu";
import {
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator
} from "mows-components-react/components/ui/dropdown-menu";
import { MowsContext } from "mows-components-react/lib/mowsContext/MowsContext";
import { type CSSProperties, PureComponent } from "react";
import { IoCodeSlashSharp } from "react-icons/io5";
import { type FilezContextType, withFilez } from "../lib/filezContext/FilezContext";

interface PrimaryMenuProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly defaultOpen?: boolean;
    readonly position?: MowsPrimaryMenuProps[`position`];
    readonly filez: FilezContextType;
}

class FilezPrimaryMenuBase extends PureComponent<PrimaryMenuProps> {
    static contextType = MowsContext;
    declare context: React.ContextType<typeof MowsContext>;

    render = () => {
        const { t } = this.context!;
        const filezUser = this.props.filez.ownFilezUser;

        return (
            <PrimaryMenu
                className={this.props.className}
                style={this.props.style}
                defaultOpen={this.props.defaultOpen}
                position={this.props.position}
                loading={this.props.filez.clientLoading}
                showSwitchUser
                user={{ displayName: filezUser?.display_name, id: filezUser?.id }}
                extraItems={
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className={`select-none`}>
                            {t.primaryMenu.developer}
                        </DropdownMenuLabel>
                        <DropdownMenuItem
                            className={`cursor-pointer`}
                            onClick={() => {
                                history.pushState({}, ``, `/dev/`);
                            }}
                        >
                            <IoCodeSlashSharp className={`inline h-4 w-4`} />
                            <span> {t.primaryMenu.developerTools}</span>
                        </DropdownMenuItem>
                    </>
                }
            />
        );
    };
}

export default withFilez(FilezPrimaryMenuBase);
