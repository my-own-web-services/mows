import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ListUserGroupsFilter } from "filez-client-typescript";
import { MockFilezProvider, apiOk, buildUserGroup } from "../testUtils";
import UserGroupPicker from "./UserGroupPicker";

describe(`UserGroupPicker`, () => {
    it(`shows the placeholder copy when no value is selected`, async () => {
        const getUserGroups = vi.fn().mockResolvedValue([]);
        render(
            <MockFilezProvider>
                <UserGroupPicker getUserGroups={getUserGroups} />
            </MockFilezProvider>
        );
        await waitFor(() => {
            expect(screen.getByText(`Select user group`)).toBeInTheDocument();
        });
    });

    it(`auto-selects the only group when there is exactly one option`, async () => {
        const onValueChange = vi.fn();
        const single = buildUserGroup({ name: `Only one` });
        const getUserGroups = vi.fn().mockResolvedValue([single]);

        render(
            <MockFilezProvider>
                <UserGroupPicker
                    getUserGroups={getUserGroups}
                    onValueChange={onValueChange}
                />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(onValueChange).toHaveBeenCalledWith(single);
        });
    });

    it(`renders the standalone list when used inside a modal`, async () => {
        const getUserGroups = vi
            .fn()
            .mockResolvedValue([buildUserGroup({ name: `Alpha` })]);

        render(
            <MockFilezProvider>
                <UserGroupPicker standalone getUserGroups={getUserGroups} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(`Alpha`)).toBeInTheDocument();
        });
    });

    it(`forwards the filter prop to listUserGroups when no getUserGroups override is set`, async () => {
        const listUserGroups = vi
            .fn()
            .mockResolvedValue(apiOk({ user_groups: [], total_count: 0 }));

        render(
            <MockFilezProvider overrides={{ api: { listUserGroups } }}>
                <UserGroupPicker filter={ListUserGroupsFilter.Member} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(listUserGroups).toHaveBeenCalledTimes(1);
        });
        expect(listUserGroups.mock.calls[0][0].filter).toBe(
            ListUserGroupsFilter.Member
        );
    });
});
