import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MockFilezProvider, apiOk } from "../testUtils";
import UserGroupPendingDashboard from "./UserGroupPendingDashboard";

const inv = (userGroupId: string) => ({
    user_id: `00000000-0000-0000-0000-000000000ddd`,
    user_group_id: userGroupId,
    invited_time: `2026-01-01T00:00:00Z`,
    invited_by: `00000000-0000-0000-0000-000000000bbb`,
    message: `Join the team`
});

describe(`UserGroupPendingDashboard`, () => {
    it(`renders both Invitations and My requests tabs`, async () => {
        const listMyInvitations = vi
            .fn()
            .mockResolvedValue(apiOk({ invitations: [] }));
        const listMyJoinRequests = vi
            .fn()
            .mockResolvedValue(apiOk({ join_requests: [] }));
        render(
            <MockFilezProvider
                overrides={{ api: { listMyInvitations, listMyJoinRequests } }}
            >
                <UserGroupPendingDashboard />
            </MockFilezProvider>
        );
        await waitFor(() => {
            expect(screen.getByRole(`tab`, { name: /Invitations/ })).toBeInTheDocument();
            expect(screen.getByRole(`tab`, { name: /My requests/ })).toBeInTheDocument();
        });
    });

    it(`calls acceptInvitation when the Accept button is clicked`, async () => {
        const listMyInvitations = vi
            .fn()
            .mockResolvedValueOnce(
                apiOk({ invitations: [inv(`00000000-0000-0000-0000-000000000aaa`)] })
            )
            .mockResolvedValue(apiOk({ invitations: [] }));
        const listMyJoinRequests = vi
            .fn()
            .mockResolvedValue(apiOk({ join_requests: [] }));
        const acceptInvitation = vi.fn().mockResolvedValue(apiOk({}));

        render(
            <MockFilezProvider
                overrides={{
                    api: { listMyInvitations, listMyJoinRequests, acceptInvitation }
                }}
            >
                <UserGroupPendingDashboard />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(`Join the team`)).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole(`button`, { name: `Accept` }));
        await waitFor(() => {
            expect(acceptInvitation).toHaveBeenCalledWith(
                `00000000-0000-0000-0000-000000000aaa`
            );
        });
    });

    it(`calls declineInvitation when the Decline button is clicked`, async () => {
        const listMyInvitations = vi
            .fn()
            .mockResolvedValueOnce(
                apiOk({ invitations: [inv(`00000000-0000-0000-0000-000000000ccc`)] })
            )
            .mockResolvedValue(apiOk({ invitations: [] }));
        const listMyJoinRequests = vi
            .fn()
            .mockResolvedValue(apiOk({ join_requests: [] }));
        const declineInvitation = vi.fn().mockResolvedValue(apiOk({}));

        render(
            <MockFilezProvider
                overrides={{
                    api: { listMyInvitations, listMyJoinRequests, declineInvitation }
                }}
            >
                <UserGroupPendingDashboard />
            </MockFilezProvider>
        );

        await waitFor(() => {
            expect(screen.getByText(`Join the team`)).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole(`button`, { name: `Decline` }));
        await waitFor(() => {
            expect(declineInvitation).toHaveBeenCalledWith(
                `00000000-0000-0000-0000-000000000ccc`
            );
        });
    });
});
