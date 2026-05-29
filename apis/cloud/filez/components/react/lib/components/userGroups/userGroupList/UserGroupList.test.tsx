import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ListUserGroupsFilter } from "filez-client-typescript";
import {
    MockFilezProvider,
    apiOk,
    buildUserGroup
} from "../testUtils";
import UserGroupList from "./UserGroupList";

const renderList = (overrides: Parameters<typeof MockFilezProvider>[0]["overrides"]) =>
    render(
        <MockFilezProvider overrides={overrides}>
            <UserGroupList />
        </MockFilezProvider>
    );

describe(`UserGroupList`, () => {
    it(`renders all six discovery-filter tabs`, async () => {
        const listUserGroups = vi
            .fn()
            .mockResolvedValue(apiOk({ user_groups: [], total_count: 0 }));
        renderList({ api: { listUserGroups } });

        for (const label of [`Owned`, `Joined`, `Invited`, `Requested`, `Server`, `Public`]) {
            expect(screen.getByRole(`tab`, { name: label })).toBeInTheDocument();
        }
    });

    it(`calls listUserGroups with the default Owned filter on mount`, async () => {
        const listUserGroups = vi
            .fn()
            .mockResolvedValue(apiOk({ user_groups: [], total_count: 0 }));
        renderList({ api: { listUserGroups } });

        await waitFor(() => {
            expect(listUserGroups).toHaveBeenCalledTimes(1);
        });
        expect(listUserGroups.mock.calls[0][0].filter).toBe(ListUserGroupsFilter.Owned);
    });

    it(`renders the group name + visibility + join-policy badges for each row`, async () => {
        const listUserGroups = vi.fn().mockResolvedValue(
            apiOk({
                user_groups: [
                    buildUserGroup({ name: `Engineering` }),
                    buildUserGroup({
                        id: `00000000-0000-0000-0000-000000000bbb`,
                        name: `Marketing`
                    })
                ],
                total_count: 2
            })
        );
        renderList({ api: { listUserGroups } });

        await waitFor(() => {
            expect(screen.getByText(`Engineering`)).toBeInTheDocument();
            expect(screen.getByText(`Marketing`)).toBeInTheDocument();
        });
        expect(screen.getAllByText(`Private`).length).toBeGreaterThan(0);
        expect(screen.getAllByText(`Invite only`).length).toBeGreaterThan(0);
    });

    it(`shows the empty-state copy when the active tab returns no groups`, async () => {
        const listUserGroups = vi
            .fn()
            .mockResolvedValue(apiOk({ user_groups: [], total_count: 0 }));
        renderList({ api: { listUserGroups } });

        await waitFor(() => {
            expect(screen.getByText(/No user groups match this filter/i)).toBeInTheDocument();
        });
    });

    it(`re-calls listUserGroups with the new filter when the user switches tabs`, async () => {
        const listUserGroups = vi
            .fn()
            .mockResolvedValue(apiOk({ user_groups: [], total_count: 0 }));
        const user = userEvent.setup();
        renderList({ api: { listUserGroups } });

        await waitFor(() => {
            expect(listUserGroups).toHaveBeenCalledTimes(1);
            expect(listUserGroups.mock.calls[0][0].filter).toBe(
                ListUserGroupsFilter.Owned
            );
        });

        await user.click(screen.getByRole(`tab`, { name: `Invited` }));

        await waitFor(() => {
            expect(listUserGroups).toHaveBeenCalledTimes(2);
        });
        expect(listUserGroups.mock.calls[1][0].filter).toBe(
            ListUserGroupsFilter.Invited
        );
    });
});
