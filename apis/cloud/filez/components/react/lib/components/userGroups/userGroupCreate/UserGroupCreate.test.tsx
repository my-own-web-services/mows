import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
    MockFilezProvider,
    apiOk,
    buildUserGroup
} from "../testUtils";
import UserGroupCreate from "./UserGroupCreate";

describe(`UserGroupCreate`, () => {
    it(`renders the name input with placeholder + label`, () => {
        render(
            <MockFilezProvider>
                <UserGroupCreate />
            </MockFilezProvider>
        );
        expect(screen.getByText(`User Group Name`)).toBeInTheDocument();
        expect(screen.getByPlaceholderText(`Enter user group name`)).toBeInTheDocument();
    });

    it(`disables Create until the user types a name`, () => {
        render(
            <MockFilezProvider>
                <UserGroupCreate />
            </MockFilezProvider>
        );
        const createButton = screen.getByRole(`button`, { name: /create/i });
        expect(createButton).toBeDisabled();
    });

    it(`shows required-name error when submitting an all-whitespace name`, () => {
        render(
            <MockFilezProvider>
                <UserGroupCreate />
            </MockFilezProvider>
        );
        const input = screen.getByPlaceholderText(`Enter user group name`);
        fireEvent.change(input, { target: { value: `  ` } });
        // input becomes non-empty so button enables — but a leading-space
        // value still fails the trim guard inside handleCreate. We fire
        // Enter to reach the same branch.
        fireEvent.keyDown(input, { key: `Enter` });
        expect(screen.getByText(/required/i)).toBeInTheDocument();
    });

    it(`calls createUserGroup with the trimmed name and surfaces the created group`, async () => {
        const created = buildUserGroup({ name: `Platform` });
        const createUserGroup = vi.fn().mockResolvedValue(
            apiOk({ created_user_group: created })
        );
        const onUserGroupCreated = vi.fn();

        render(
            <MockFilezProvider overrides={{ api: { createUserGroup } }}>
                <UserGroupCreate onUserGroupCreated={onUserGroupCreated} />
            </MockFilezProvider>
        );

        fireEvent.change(screen.getByPlaceholderText(`Enter user group name`), {
            target: { value: `  Platform  ` }
        });
        fireEvent.click(screen.getByRole(`button`, { name: /^create$/i }));

        await waitFor(() => {
            expect(createUserGroup).toHaveBeenCalledWith({ user_group_name: `Platform` });
            expect(onUserGroupCreated).toHaveBeenCalledWith(created);
        });
    });
});
