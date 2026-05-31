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
        label: `بوب`,
        description: `bob@example.com`
    },
    {
        kind: `userGroup`,
        id: `11111111-1111-1111-1111-111111111111`,
        label: `فريق-أ`,
        description: `٣ أعضاء`
    },
    {
        kind: `public`,
        id: SENTINEL_UUID,
        label: `عام`
    }
];

const ACTIONS = [
    { id: `ChannelsRead`, label: `قراءة`, description: `قراءة الرسائل ورؤية القناة في الشريط الجانبي`, implies: [`ChannelsList`] },
    { id: `ChannelsList`, label: `قائمة فقط`, description: `إظهار القناة في الشريط الجانبي فقط` },
    { id: `ChannelsPublish`, label: `نشر`, description: `إرسال رسائل إلى هذه القناة` }
];

const Example = () => {
    const [open, setOpen] = useState(false);
    useExampleState({ direction: `rtl`, open });

    return (
        <div dir={`rtl`} className={`flex w-full max-w-md flex-col gap-3`}>
            <Button onClick={() => setOpen(true)}>فتح حوار المشاركة</Button>
            <ShareDialog
                open={open}
                onOpenChange={setOpen}
                resourceLabel={`القناة #فريق-غرفة`}
                subjects={SUBJECTS}
                actions={ACTIONS}
                strings={{
                    titlePrefix: `مشاركة`,
                    subjectHeading: `مشاركة مع`,
                    subjectTabUser: `مستخدم`,
                    subjectTabUserGroup: `مجموعة مستخدمين`,
                    subjectTabPublic: `أي شخص بالرابط`,
                    subjectTabServerMember: `أعضاء هذا الخادم`,
                    actionsHeading: `منح`,
                    cancel: `إلغاء`,
                    submit: `مشاركة`
                }}
                onShare={async () => {
                    setOpen(false);
                }}
            />
        </div>
    );
};

const module: ExampleModule = {
    strings: (t) => t.examples.shareDialog.rtl,
    Example
};

export default module;
