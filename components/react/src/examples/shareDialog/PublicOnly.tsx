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
        kind: `public`,
        id: SENTINEL_UUID,
        label: `Public`
    }
];

const ACTIONS = [{ id: `FilezFilesGet`, label: `Read`, description: `Anyone can open the file` }];

const Example = () => {
    const [open, setOpen] = useState(false);
    const [latest, setLatest] = useState<string | null>(null);
    useExampleState({ open });

    return (
        <div className={`flex w-full max-w-md flex-col gap-3`}>
            <Button onClick={() => setOpen(true)}>Share publicly</Button>
            {latest !== null && (
                <p className={`text-muted-foreground text-xs`}>
                    Last submitted: {latest}
                </p>
            )}
            <ShareDialog
                open={open}
                onOpenChange={setOpen}
                resourceLabel={`public-press-release.pdf`}
                resourceDescription={`Only the Public sentinel is offered — the dialog hides the other subject tabs when only one kind is supplied.`}
                subjects={SUBJECTS}
                actions={ACTIONS}
                onShare={async (input) => {
                    setLatest(
                        `${input.subject.label} → ${input.actions.join(`, `)}`
                    );
                }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.shareDialog.publicOnly,
    Example
};

export default module;
