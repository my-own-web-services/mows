import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "../../../lib/components/ui/tabs";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ defaultValue: `one` });

    return (
        <Tabs defaultValue={`one`} className={`w-full max-w-md`}>
            <TabsList>
                <TabsTrigger value={`one`}>One</TabsTrigger>
                <TabsTrigger value={`two`}>Two</TabsTrigger>
                <TabsTrigger value={`three`}>Three</TabsTrigger>
            </TabsList>
            <TabsContent value={`one`} className={`pt-3`}>
                Panel one content.
            </TabsContent>
            <TabsContent value={`two`} className={`pt-3`}>
                Panel two content.
            </TabsContent>
            <TabsContent value={`three`} className={`pt-3`}>
                Panel three content.
            </TabsContent>
        </Tabs>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.tabs.default,
    Example
};

export default module;
