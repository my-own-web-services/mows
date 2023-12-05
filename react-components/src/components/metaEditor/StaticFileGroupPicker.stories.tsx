import type { Meta, StoryObj } from "@storybook/react";
import StaticFileGroupPicker from "./StaticFileGroupPicker";
import { FilezClient } from "@firstdorsal/filez-client";
const filezClientConfig = {
    interosseaServerAddress: "http://accounts-server.localhost",
    interosseaWebAddress: "http://accounts.localhost",
    filezServerAddress: "http://filez-server.localhost",
    skipInterossea: false,
    applicationId: "filez-storybooks"
};

const meta: Meta<typeof StaticFileGroupPicker> = {
    title: "Atoms/StaticFileGroupPicker",
    component: StaticFileGroupPicker,
    render: (args, { loaded: { resources } }) => (
        <StaticFileGroupPicker {...args} resources={resources} />
    )
};

export default meta;

type Story = StoryObj<StaticFileGroupPicker>;

export const Primary: Story = {
    args: {},
    loaders: [
        async () => ({
            resources: (async () => {
                const filezClient = new FilezClient(
                    filezClientConfig.filezServerAddress,
                    filezClientConfig.interosseaServerAddress,
                    filezClientConfig.interosseaWebAddress,
                    filezClientConfig.applicationId,
                    filezClientConfig.skipInterossea
                );
                await filezClient.init();
                console.log("filezClient", filezClient);

                const user = await filezClient.get_own_user();

                const files = await filezClient.get_file_infos_by_group_id({
                    id: user._id + "_all"
                });
                // select 5 files at random
                const selectedFiles = files.items
                    .sort(() => Math.random() - Math.random())
                    .slice(0, 5);
                return await filezClient.get_file_infos(selectedFiles.map(file => file._id));
            })()
        })
    ]
};
