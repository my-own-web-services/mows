import { useState } from "react";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "../../../lib/components/ui/tabs";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    const [value, setValue] = useState(`one`);
    useExampleState({ value });

    return (
        <div className={`flex flex-col gap-3`}>
            <p className={`text-sm text-muted-foreground`}>
                Active tab: <code>{value}</code>
            </p>
            <Tabs
                value={value}
                onValueChange={setValue}
                className={`w-full max-w-md`}
            >
                <TabsList>
                    <TabsTrigger value={`one`}>One</TabsTrigger>
                    <TabsTrigger value={`two`}>Two</TabsTrigger>
                </TabsList>
                <TabsContent value={`one`} className={`pt-3`}>
                    Panel one.
                </TabsContent>
                <TabsContent value={`two`} className={`pt-3`}>
                    Panel two.
                </TabsContent>
            </Tabs>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.tabs.controlled,
    Example
};

export default module;
