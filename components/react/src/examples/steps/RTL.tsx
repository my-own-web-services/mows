import { Step, Steps } from "../../../lib/components/ui/steps";
import { useExampleState } from "../harness/useExampleState";
import type { ExampleModule } from "../harness/types";

const Example = () => {
    useExampleState({ dir: `rtl`, current: 1 });

    return (
        <div dir={`rtl`} className={`flex flex-col gap-6`}>
            <Steps current={1}>
                <Step title={`الحساب`} description={`إنشاء حساب جديد`} />
                <Step title={`الملف`} description={`أخبرنا عن نفسك`} />
                <Step title={`المراجعة`} description={`تأكيد التفاصيل`} />
                <Step title={`تم`} />
            </Steps>
            <Steps orientation={`vertical`} current={1} className={`max-w-sm`}>
                <Step title={`الحساب`} description={`إنشاء حساب جديد`} />
                <Step title={`الملف`} description={`أخبرنا عن نفسك`} />
                <Step title={`تم`} />
            </Steps>
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.steps.rtl,
    Example
};

export default module;
