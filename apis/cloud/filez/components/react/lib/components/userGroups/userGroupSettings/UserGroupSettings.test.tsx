import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupJoinPolicy, GroupVisibility } from "filez-client-typescript";
import {
    MockFilezProvider,
    apiOk,
    buildUserGroup
} from "../testUtils";
import UserGroupSettings from "./UserGroupSettings";

describe(`UserGroupSettings`, () => {
    it(`pre-fills the form with the supplied user group`, () => {
        const group = buildUserGroup({
            name: `Engineering`,
            description: `The eng team`,
            visibility: GroupVisibility.Public,
            join_policy: GroupJoinPolicy.OpenJoin
        });
        render(
            <MockFilezProvider>
                <UserGroupSettings userGroup={group} />
            </MockFilezProvider>
        );
        expect(screen.getByLabelText(`Name`)).toHaveValue(`Engineering`);
        expect(screen.getByLabelText(`Description`)).toHaveValue(`The eng team`);
    });

    it(`calls onCancel without an update when nothing changed`, async () => {
        const updateUserGroup = vi.fn();
        const onCancel = vi.fn();
        render(
            <MockFilezProvider overrides={{ api: { updateUserGroup } }}>
                <UserGroupSettings userGroup={buildUserGroup()} onCancel={onCancel} />
            </MockFilezProvider>
        );
        fireEvent.click(screen.getByRole(`button`, { name: /save/i }));
        await waitFor(() => {
            expect(onCancel).toHaveBeenCalledTimes(1);
            expect(updateUserGroup).not.toHaveBeenCalled();
        });
    });

    it(`sends only the changed fields in the changeset`, async () => {
        const updateUserGroup = vi.fn().mockResolvedValue(
            apiOk({
                outcome: {
                    auto_promoted_requests: 0,
                    updated_user_group: buildUserGroup({ name: `Renamed` })
                }
            })
        );
        render(
            <MockFilezProvider overrides={{ api: { updateUserGroup } }}>
                <UserGroupSettings userGroup={buildUserGroup({ name: `Engineering` })} />
            </MockFilezProvider>
        );

        fireEvent.change(screen.getByLabelText(`Name`), { target: { value: `Renamed` } });
        fireEvent.click(screen.getByRole(`button`, { name: /save/i }));

        await waitFor(() => {
            expect(updateUserGroup).toHaveBeenCalledTimes(1);
        });
        const payload = updateUserGroup.mock.calls[0][0];
        expect(payload.changeset).toEqual({ new_user_group_name: `Renamed` });
    });

    it(`clears the description with explicit null when emptied`, async () => {
        const updateUserGroup = vi.fn().mockResolvedValue(
            apiOk({
                outcome: {
                    auto_promoted_requests: 0,
                    updated_user_group: buildUserGroup({ description: null })
                }
            })
        );
        render(
            <MockFilezProvider overrides={{ api: { updateUserGroup } }}>
                <UserGroupSettings
                    userGroup={buildUserGroup({ description: `the team` })}
                />
            </MockFilezProvider>
        );

        fireEvent.change(screen.getByLabelText(`Description`), { target: { value: `` } });
        fireEvent.click(screen.getByRole(`button`, { name: /save/i }));

        await waitFor(() => {
            expect(updateUserGroup).toHaveBeenCalledTimes(1);
        });
        expect(updateUserGroup.mock.calls[0][0].changeset).toEqual({
            new_description: null
        });
    });

    it(`sends only new_visibility when only the visibility dropdown changes`, async () => {
        const updateUserGroup = vi.fn().mockResolvedValue(
            apiOk({
                outcome: {
                    auto_promoted_requests: 0,
                    updated_user_group: buildUserGroup({
                        visibility: GroupVisibility.Public
                    })
                }
            })
        );
        const group = buildUserGroup({ visibility: GroupVisibility.Private });
        const { container } = render(
            <MockFilezProvider overrides={{ api: { updateUserGroup } }}>
                <UserGroupSettings userGroup={group} />
            </MockFilezProvider>
        );

        // Bypass the Radix Select keyboard / pointer dance by reaching for
        // the instance directly — we're proving the changeset shape, not
        // the picker UX. The picker's interaction is covered separately.
        const instance = (container.firstChild as unknown as {
            _reactRootContainer?: unknown;
        });
        void instance;
        // Call the public state-mutation handler that the Select would
        // fire on a real change. Pulling the rendered class instance via
        // a ref is impractical here; instead, mount the change via the
        // onValueChange path by simulating the click sequence is fragile.
        // The simpler route is to assert the changeset logic through the
        // handleVisibilityChange path indirectly: use the radio-less
        // primitive shape via JSDOM by dispatching a custom event the
        // Select consumes. That's also fragile.
        //
        // Pragmatic compromise: change visibility via the dropdown's
        // hidden combobox role.
        const visibilitySelect = screen.getByRole(`combobox`, {
            name: `Visibility`
        });
        fireEvent.keyDown(visibilitySelect, { key: `Enter` });
        // Radix opens to a portaled listbox; search for the Public option
        // text and click.
        const publicOption = await screen.findByRole(`option`, {
            name: /Public/i
        });
        fireEvent.click(publicOption);

        fireEvent.click(screen.getByRole(`button`, { name: /save/i }));

        await waitFor(() => {
            expect(updateUserGroup).toHaveBeenCalledTimes(1);
        });
        expect(updateUserGroup.mock.calls[0][0].changeset).toEqual({
            new_visibility: GroupVisibility.Public
        });
    });

    it(`sends only new_join_policy when only the join-policy dropdown changes`, async () => {
        const updateUserGroup = vi.fn().mockResolvedValue(
            apiOk({
                outcome: {
                    auto_promoted_requests: 0,
                    updated_user_group: buildUserGroup({
                        join_policy: GroupJoinPolicy.OpenJoin
                    })
                }
            })
        );
        const group = buildUserGroup({ join_policy: GroupJoinPolicy.InviteOnly });
        render(
            <MockFilezProvider overrides={{ api: { updateUserGroup } }}>
                <UserGroupSettings userGroup={group} />
            </MockFilezProvider>
        );

        const joinPolicySelect = screen.getByRole(`combobox`, {
            name: `Join Policy`
        });
        fireEvent.keyDown(joinPolicySelect, { key: `Enter` });
        const openOption = await screen.findByRole(`option`, {
            name: /Open join/i
        });
        fireEvent.click(openOption);

        fireEvent.click(screen.getByRole(`button`, { name: /save/i }));

        await waitFor(() => {
            expect(updateUserGroup).toHaveBeenCalledTimes(1);
        });
        expect(updateUserGroup.mock.calls[0][0].changeset).toEqual({
            new_join_policy: GroupJoinPolicy.OpenJoin
        });
    });
});
