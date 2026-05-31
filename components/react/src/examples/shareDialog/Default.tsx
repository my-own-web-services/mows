import { useState } from "react";

import { Button } from "../../../lib/components/ui/button";
import {
    SENTINEL_UUID,
    ShareDialog,
    type ShareSubjectOption
} from "../../../lib/components/identity/shareDialog";
import type { ExampleModule } from "../harness/types";
import { useExampleState } from "../harness/useExampleState";

const SUBJECTS: ShareSubjectOption[] = [
    {
        kind: `user`,
        id: `b0b00000-0000-0000-0000-000000000002`,
        label: `Bob`,
        description: `bob@example.com`
    },
    {
        kind: `user`,
        id: `ca401000-0000-0000-0000-000000000003`,
        label: `Carol`,
        description: `carol@example.com`
    },
    {
        kind: `userGroup`,
        id: `11111111-1111-1111-1111-111111111111`,
        label: `team-a`,
        description: `3 members`
    },
    {
        kind: `userGroup`,
        id: `22222222-2222-2222-2222-222222222222`,
        label: `reviewers`,
        description: `5 members`
    },
    {
        kind: `serverMember`,
        id: SENTINEL_UUID,
        label: `Server members`
    }
];

const ACTIONS = [
    {
        id: `ChannelsRead`,
        label: `Read`,
        description: `Read messages and see this channel in the sidebar`,
        implies: [`ChannelsList`]
    },
    {
        id: `ChannelsList`,
        label: `List only`,
        description: `Make the channel appear in the sidebar without read access`
    },
    {
        id: `ChannelsPublish`,
        label: `Publish`,
        description: `Send messages to this channel`
    }
];

const Example = () => {
    const [open, setOpen] = useState(false);
    const [latest, setLatest] = useState<string | null>(null);
    useExampleState({ open });

    return (
        <div className={`flex w-full max-w-md flex-col gap-3`}>
            <Button onClick={() => setOpen(true)}>Open share dialog</Button>
            {latest !== null && (
                <p className={`text-muted-foreground text-xs`}>
                    Last submitted: {latest}
                </p>
            )}
            <ShareDialog
                open={open}
                onOpenChange={setOpen}
                resourceLabel={`channel #team-room`}
                resourceDescription={`Grant another subject access to this channel.`}
                subjects={SUBJECTS}
                actions={ACTIONS}
                onShare={async (input) => {
                    setLatest(
                        `${input.subject.label} (${input.subject.kind}) → ${input.actions.join(`, `)}`
                    );
                }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.shareDialog.default,
    Example
};

export default module;
