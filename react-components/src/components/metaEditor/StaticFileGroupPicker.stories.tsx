import type { Meta, StoryObj } from "@storybook/react";
import StaticFileGroupPicker from "./StaticFileGroupPicker";
import { FilezClient } from "@firstdorsal/filez-client";
import FilezProvider from "../../FilezProvider";
const filezClientConfigStorybook = {
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
        <FilezProvider uiConfig={filezClientConfigStorybook}>
            <StaticFileGroupPicker {...args} resources={resources} />
        </FilezProvider>
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
                    filezClientConfigStorybook.filezServerAddress,
                    filezClientConfigStorybook.interosseaServerAddress,
                    filezClientConfigStorybook.interosseaWebAddress,
                    filezClientConfigStorybook.applicationId,
                    filezClientConfigStorybook.skipInterossea
                );
                await filezClient.init();

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
