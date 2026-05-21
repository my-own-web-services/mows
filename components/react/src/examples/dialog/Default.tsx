import { Button } from "../../../lib/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "../../../lib/components/ui/dialog";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({});

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>
                        This action cannot be undone. Deleting removes the record
                        permanently.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant={`outline`}>Cancel</Button>
                    </DialogClose>
                    <Button variant={`destructive`}>Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.dialog.default,
    Example
};

export default module;
