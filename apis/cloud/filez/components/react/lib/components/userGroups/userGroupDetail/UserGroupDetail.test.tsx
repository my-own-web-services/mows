import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupJoinPolicy, GroupVisibility } from "filez-client-typescript";
import {
    MockFilezProvider,
    apiOk,
    buildUser,
    buildUserGroup
} from "../testUtils";
import UserGroupDetail from "./UserGroupDetail";

describe(`UserGroupDetail`, () => {
    it(`shows the owner-only tabs when the viewer is the owner`, async () => {
        const owner = buildUser({ id: `00000000-0000-0000-0000-000000000ddd` });
        const group = buildUserGroup({ owner_id: owner.id });
        const listUsersByUserGroup = vi
            .fn()
            .mockResolvedValue(apiOk({ users: [owner], total_count: 1 }));
        const listGroupInvitations = vi
            .fn()
            .mockResolvedValue(apiOk({ invitations: [] }));
        const listGroupJoinRequests = vi
            .fn()
            .mockResolvedValue(apiOk({ join_requests: [] }));

        render(
            <MockFilezProvider
                overrides={{
                    ownFilezUser: owner,
                    api: {
                        listUsersByUserGroup,
                        listGroupInvitations,
                        listGroupJoinRequests
                    }
                }}
            >
                <UserGroupDetail userGroup={group} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByRole(`tab`, { name: `Members` })).toBeInTheDocument();
            expect(screen.getByRole(`tab`, { name: `Invitations` })).toBeInTheDocument();
            expect(screen.getByRole(`tab`, { name: `Join requests` })).toBeInTheDocument();
        });
    });

    it(`hides the owner-only tabs when the viewer is just a member`, async () => {
        const owner = buildUser({ id: `00000000-0000-0000-0000-000000000ddd` });
        const viewer = buildUser({
            id: `00000000-0000-0000-0000-00000000eeee`,
            display_name: `Viewer`
        });
        const group = buildUserGroup({ owner_id: owner.id });

        const listUsersByUserGroup = vi
            .fn()
            .mockResolvedValue(apiOk({ users: [owner, viewer], total_count: 2 }));

        render(
            <MockFilezProvider
                overrides={{
                    ownFilezUser: viewer,
                    api: { listUsersByUserGroup }
                }}
            >
                <UserGroupDetail userGroup={group} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByRole(`tab`, { name: `Members` })).toBeInTheDocument();
        });
        expect(
            screen.queryByRole(`tab`, { name: `Invitations` })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole(`tab`, { name: `Join requests` })
        ).not.toBeInTheDocument();
    });

    it(`offers a request-to-join button for non-members of a RequestToJoin group`, async () => {
        const stranger = buildUser({
            id: `00000000-0000-0000-0000-00000000ffff`,
            display_name: `Stranger`
        });
        const group = buildUserGroup({
            owner_id: `00000000-0000-0000-0000-000000000ddd`,
            join_policy: GroupJoinPolicy.RequestToJoin,
            visibility: GroupVisibility.ListedRestricted
        });
        const listUsersByUserGroup = vi
            .fn()
            .mockResolvedValue(apiOk({ users: [], total_count: 0 }));

        render(
            <MockFilezProvider
                overrides={{
                    ownFilezUser: stranger,
                    api: { listUsersByUserGroup }
                }}
            >
                <UserGroupDetail userGroup={group} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(
                screen.getByRole(`button`, { name: /Request to join/i })
            ).toBeInTheDocument();
        });
    });

    it(`offers a direct Join button for non-members of an OpenJoin group`, async () => {
        const stranger = buildUser({
            id: `00000000-0000-0000-0000-00000000ffff`,
            display_name: `Stranger`
        });
        const group = buildUserGroup({
            owner_id: `00000000-0000-0000-0000-000000000ddd`,
            join_policy: GroupJoinPolicy.OpenJoin,
            visibility: GroupVisibility.Public
        });
        const listUsersByUserGroup = vi
            .fn()
            .mockResolvedValue(apiOk({ users: [], total_count: 0 }));

        render(
            <MockFilezProvider
                overrides={{
                    ownFilezUser: stranger,
                    api: { listUsersByUserGroup }
                }}
            >
                <UserGroupDetail userGroup={group} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(
                screen.getByRole(`button`, { name: /^Join$/i })
            ).toBeInTheDocument();
        });
    });

    it(`offers no join affordance for non-members of an InviteOnly group`, async () => {
        const stranger = buildUser({
            id: `00000000-0000-0000-0000-00000000ffff`,
            display_name: `Stranger`
        });
        const group = buildUserGroup({
            owner_id: `00000000-0000-0000-0000-000000000ddd`,
            join_policy: GroupJoinPolicy.InviteOnly,
            visibility: GroupVisibility.ListedRestricted
        });
        const listUsersByUserGroup = vi
            .fn()
            .mockResolvedValue(apiOk({ users: [], total_count: 0 }));

        render(
            <MockFilezProvider
                overrides={{
                    ownFilezUser: stranger,
                    api: { listUsersByUserGroup }
                }}
            >
                <UserGroupDetail userGroup={group} />
            </MockFilezProvider>
        );

        await waitFor(() => {
            // Members tab is always present; that's the wait-for anchor.
            expect(screen.getByRole(`tab`, { name: `Members` })).toBeInTheDocument();
        });
        expect(screen.queryByRole(`button`, { name: /^Join$/i })).not.toBeInTheDocument();
        expect(
            screen.queryByRole(`button`, { name: /Request to join/i })
        ).not.toBeInTheDocument();
    });
});
