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
    useExampleState({ showCloseButton: false });

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button>Open without X</Button>
            </DialogTrigger>
            <DialogContent showCloseButton={false}>
                <DialogHeader>
                    <DialogTitle>Confirm</DialogTitle>
                    <DialogDescription>
                        Closing requires an explicit action — the corner X is hidden.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button>OK</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.dialog.hideClose,
    Example
};

export default module;
