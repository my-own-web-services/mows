import { CreditCard, Package, ShieldCheck, User } from "lucide-react";
import type { ReactNode } from "react";
import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

// `<Step title>` accepts any ReactNode, so we can put an icon next to the
// text without changes to the <Steps> primitive itself.
const TitleWithIcon = ({ icon, text }: { icon: ReactNode; text: string }) => (
    <span className={`inline-flex items-center gap-1.5`}>
        {icon}
        {text}
    </span>
);

const Example = () => {
    useExampleState({ current: 2 });

    return (
        <Steps current={2}>
            <Step
                title={<TitleWithIcon icon={<User className={`h-3.5 w-3.5`} />} text={`Account`} />}
            />
            <Step
                title={
                    <TitleWithIcon
                        icon={<CreditCard className={`h-3.5 w-3.5`} />}
                        text={`Billing`}
                    />
                }
            />
            <Step
                title={
                    <TitleWithIcon
                        icon={<Package className={`h-3.5 w-3.5`} />}
                        text={`Shipping`}
                    />
                }
            />
            <Step
                title={
                    <TitleWithIcon
                        icon={<ShieldCheck className={`h-3.5 w-3.5`} />}
                        text={`Confirm`}
                    />
                }
            />
        </Steps>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.icons,
    Example
};

export default module;
