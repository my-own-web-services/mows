import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "../../../lib/components/ui/tabs";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ disabled: [`three`] });

    return (
        <Tabs defaultValue={`one`} className={`w-full max-w-md`}>
            <TabsList>
                <TabsTrigger value={`one`}>One</TabsTrigger>
                <TabsTrigger value={`two`}>Two</TabsTrigger>
                <TabsTrigger value={`three`} disabled>
                    Three
                </TabsTrigger>
            </TabsList>
            <TabsContent value={`one`} className={`pt-3`}>
                Panel one.
            </TabsContent>
            <TabsContent value={`two`} className={`pt-3`}>
                Panel two.
            </TabsContent>
            <TabsContent value={`three`} className={`pt-3`}>
                You can't reach me — my trigger is disabled.
            </TabsContent>
        </Tabs>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.tabs.disabled,
    Example
};

export default module;
