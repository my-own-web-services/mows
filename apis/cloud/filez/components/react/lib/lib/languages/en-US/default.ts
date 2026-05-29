import baseEn from "@my-own-web-services/react-components/lib/languages/en-US/default";
import { CoreActionIds } from "@my-own-web-services/react-components/lib/mowsContext/coreActions";
import { FilezActionIds } from "@/lib/filezActions";
import type { Translation } from "@/lib/languages";

const translation: Translation = {
    ...baseEn,
    actions: {
        ...baseEn.actions,
        [CoreActionIds.OPEN_COMMAND_PALETTE]: `Open command palette`,
        [CoreActionIds.OPEN_KEYBOARD_SHORTCUTS]: `Open keyboard shortcuts`,
        [CoreActionIds.OPEN_LANGUAGE_SETTINGS]: `Open language settings`,
        [CoreActionIds.OPEN_THEME_SELECTOR]: `Open theme selector`,
        [CoreActionIds.OPEN_PRIMARY_MENU]: `Open primary menu`,
        [CoreActionIds.LOGIN]: `Login`,
        [CoreActionIds.LOGOUT]: `Logout`,
        [CoreActionIds.OPEN_DEV_TOOLS]: `Open developer tools`,
        [FilezActionIds.DELETE_FILES]: `Delete files`,
        [FilezActionIds.DELETE_JOBS]: `Delete jobs`,
        [FilezActionIds.CREATE_FILE_GROUP]: `Create file group`
    },
    resourceTags: {
        badges: `Badges`,
        text: `Text`,
        selected: `selected`,
        addToAll: `Add to all`,
        removeFromAll: `Remove from all`,
        saveTextTags: `Save`,
        cancel: `Cancel`,
        searchPlaceholder: `Search tags...`,
        clearSearch: `Clear search`
    },
    upload: {
        dropFilesHere: `Drop files here`,
        dropFoldersHere: `Drop folders here`,
        orClickToSelect: `or click to select files`,
        orClickToSelectFolder: `or click to select folder`,
        selectFiles: `Select files to upload`,
        removeFile: `Remove file`,
        uploadFiles: `Upload Files`,
        dropFilesOrFoldersHere: `Drop files or folders here`,
        orUseButtonsBelow: `or use the buttons below to select`,
        selectAll: `Select All`,
        selectFileGroup: `Select file group (optional)`,
        dragToResize: `Drag to resize`,
        showPreviews: `Create previews`,
        status: {
            pending: `Pending`,
            uploading: `Uploading`,
            completed: `Completed`,
            error: `Error`
        }
    },
    storageLocationPicker: {
        title: `Storage Location Selector`,
        selectStorageLocation: `Select storage location`,
        noStorageLocationFound: `No storage location found`,
        loading: `Loading storage locations...`
    },
    storageQuotaPicker: {
        title: `Storage Quota Selector`,
        selectStorageQuota: `Select storage quota`,
        noStorageQuotaFound: `No storage quota found`,
        loading: `Loading storage quotas...`
    },
    fileGroupPicker: {
        title: `File Group Selector`,
        selectFileGroup: `Select file group`,
        noFileGroupFound: `No file group found`,
        loading: `Loading file groups...`
    },
    fileGroupCreate: {
        createFileGroup: `Create File Group`,
        title: `Create New File Group`,
        description: `Create a new file group to organize your files.`,
        nameLabel: `File Group Name`,
        namePlaceholder: `Enter file group name`,
        nameRequired: `File group name is required`,
        nameTooLong: `File group name must be 256 characters or less`,
        createFailed: `Failed to create file group`,
        cancel: `Cancel`,
        create: `Create`,
        creating: `Creating...`
    },
    userGroupCreate: {
        createUserGroup: `Create User Group`,
        title: `Create New User Group`,
        description: `Create a private invite-only group. You can change visibility and join policy in settings.`,
        nameLabel: `User Group Name`,
        namePlaceholder: `Enter user group name`,
        nameRequired: `User group name is required`,
        nameTooLong: `User group name must be 256 characters or less`,
        createFailed: `Failed to create user group`,
        cancel: `Cancel`,
        create: `Create`,
        creating: `Creating...`
    },
    userGroupSettings: {
        title: `User Group Settings`,
        nameLabel: `Name`,
        nameRequired: `Name is required`,
        nameTooLong: `Name must be 256 characters or less`,
        descriptionLabel: `Description`,
        descriptionPlaceholder: `Optional — shown in the directory`,
        descriptionTooLong: `Description must be 1024 characters or less`,
        visibilityLabel: `Visibility`,
        joinPolicyLabel: `Join Policy`,
        visibility: {
            private: `Private — only owner and members can see this group`,
            listedRestricted: `Listed — every server member sees it, only owner can add`,
            public: `Public — anyone can see this group exists`
        },
        joinPolicy: {
            inviteOnly: `Invite only — owner adds members directly`,
            requestToJoin: `Request to join — users request, owner approves`,
            openJoin: `Open join — any server member can join`
        },
        updateFailed: `Failed to update user group`,
        cancel: `Cancel`,
        save: `Save`,
        saving: `Saving...`
    },
    userGroupPicker: {
        title: `User Group Selector`,
        selectUserGroup: `Select user group`,
        noUserGroupFound: `No user group found`,
        loading: `Loading user groups...`,
        loadFailed: `Failed to load user groups`
    },
    userGroupList: {
        loading: `Loading user groups...`,
        empty: `No user groups match this filter`,
        open: `Open`,
        loadFailed: `Failed to load user groups`,
        totalCount: (totalCount: number) =>
            totalCount === 1 ? `1 group` : `${totalCount} groups`,
        filters: {
            owned: `Owned`,
            member: `Joined`,
            invited: `Invited`,
            requested: `Requested`,
            serverListed: `Server`,
            public: `Public`
        },
        visibility: {
            private: `Private`,
            listedRestricted: `Listed`,
            public: `Public`
        },
        joinPolicy: {
            inviteOnly: `Invite only`,
            requestToJoin: `Request to join`,
            openJoin: `Open join`
        }
    },
    userGroupDetail: {
        loading: `Loading...`,
        working: `Working...`,
        noMembers: `No members yet`,
        noInvitations: `No pending invitations`,
        noJoinRequests: `No pending join requests`,
        ownerBadge: `Owner`,
        removeMember: `Remove`,
        invite: `Invite`,
        inviteUserIdLabel: `User ID`,
        inviteUserIdPlaceholder: `00000000-0000-0000-0000-000000000000`,
        inviteMessageLabel: `Message (optional)`,
        join: `Join`,
        requestJoin: `Request to join`,
        leave: `Leave`,
        deleteGroup: `Delete group`,
        approve: `Approve`,
        reject: `Reject`,
        invitedOn: (when: string) => `Invited ${when}`,
        requestedOn: (when: string) => `Requested ${when}`,
        groupIdPrefix: `Group ID:`,
        userIdPrefix: `User ID:`,
        errors: {
            loadMembers: `Failed to load members`,
            loadInvitations: `Failed to load invitations`,
            loadJoinRequests: `Failed to load join requests`,
            invite: `Failed to invite user`,
            approve: `Failed to approve request`,
            reject: `Failed to reject request`,
            removeMember: `Failed to remove member`,
            leave: `Failed to leave group`,
            deleteGroup: `Failed to delete group`,
            requestJoin: `Failed to request join`
        },
        tabs: {
            members: `Members`,
            invitations: `Invitations`,
            requests: `Join requests`
        }
    },
    userGroupPendingDashboard: {
        loading: `Loading...`,
        invitations: `Invitations`,
        requests: `My requests`,
        noInvitations: `No pending invitations`,
        noRequests: `No pending requests`,
        accept: `Accept`,
        decline: `Decline`,
        working: `Working...`,
        invitedOn: (when: string) => `Invited ${when}`,
        requestedOn: (when: string) => `Requested ${when}`,
        groupIdPrefix: `Group ID:`,
        errors: {
            load: `Failed to load pending items`,
            accept: `Failed to accept invitation`,
            decline: `Failed to decline invitation`
        }
    },
    jobsProgress: {
        title: `Jobs Progress`,
        inProgress: `In Progress`,
        created: `Created`,
        failed: `Failed`
    },
    common: {
        files: {
            delete: (fileCount: number) =>
                fileCount === 1 ? `Delete file` : `Delete ${fileCount} files`
        },
        jobs: {
            delete: (jobCount: number) =>
                jobCount === 1 ? `Delete job` : `Delete ${jobCount} jobs`
        }
    },
    jobList: {
        columns: {
            name: `Name`,
            status: `Status`,
            app: `App`,
            created: `Created`,
            modified: `Modified`
        }
    }
};

export default translation;
