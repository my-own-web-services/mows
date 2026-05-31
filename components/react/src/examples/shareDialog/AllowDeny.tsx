import { useState } from "react";

import { Button } from "../../../lib/components/ui/button";
import {
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
        kind: `userGroup`,
        id: `11111111-1111-1111-1111-111111111111`,
        label: `team-a`,
        description: `3 members`
    }
];

const ACTIONS = [
    { id: `FilezFilesGet`, label: `Read`, description: `Open the file` },
    {
        id: `FilezFilesUpdate`,
        label: `Update`,
        description: `Replace the file contents`
    },
    { id: `FilezFilesDelete`, label: `Delete`, description: `Delete the file` }
];

const Example = () => {
    const [open, setOpen] = useState(false);
    const [latest, setLatest] = useState<string | null>(null);
    useExampleState({ open });

    return (
        <div className={`flex w-full max-w-md flex-col gap-3`}>
            <Button onClick={() => setOpen(true)}>Open share dialog with Deny</Button>
            {latest !== null && (
                <p className={`text-muted-foreground text-xs`}>
                    Last submitted: {latest}
                </p>
            )}
            <ShareDialog
                open={open}
                onOpenChange={setOpen}
                resourceLabel={`vacation-photos.jpg`}
                resourceDescription={`The Deny radio is a precedence override — Deny beats Allow in the engine.`}
                subjects={SUBJECTS}
                actions={ACTIONS}
                allowDeny
                onShare={async (input) => {
                    setLatest(
                        `${input.effect} ${input.actions.join(`, `)} for ${input.subject.label}`
                    );
                }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.shareDialog.allowDeny,
    Example
};

export default module;
