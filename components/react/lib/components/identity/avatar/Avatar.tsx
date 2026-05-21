import { cn } from "@/lib/utils";
import { type CSSProperties, PureComponent } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface AvatarProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly displayName?: string;
}

type AvatarState = Record<string, never>;

export default class Avatar extends PureComponent<AvatarProps, AvatarState> {
    constructor(props: AvatarProps) {
        super(props);
        this.state = {};
    }

    render = () => {
        const userName = this.props.displayName;

        return (
            <div
                style={{ ...this.props.style }}
                className={cn(
                    `bg-background border-border hover:border-foreground flex h-10 w-10 items-center justify-center rounded-full outline-2`,
                    this.props.className
                )}
            >
                <span className={`flex font-bold select-none`}>
                    {userName ? userName.charAt(0).toUpperCase() : <Skeleton className={`h-4 w-4`} />}
                </span>
            </div>
        );
    };
}
