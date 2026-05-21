import { User } from "lucide-react";
import { Button } from "../../../lib/components/ui/button";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger
} from "../../../lib/components/ui/hover-card";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <HoverCard>
            <HoverCardTrigger asChild>
                <Button variant={`link`}>@mows</Button>
            </HoverCardTrigger>
            <HoverCardContent>
                <div className={`flex items-start gap-3`}>
                    <User className={`h-5 w-5`} />
                    <div className={`text-sm`}>
                        <div className={`font-medium`}>MOWS Demo</div>
                        <p className={`text-muted-foreground`}>
                            Hover the link to see this card; focus it via Tab too.
                        </p>
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.hoverCard.default,
    Example
};

export default module;
