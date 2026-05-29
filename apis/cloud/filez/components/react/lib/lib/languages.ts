import {
    type Language as MowsLanguage,
    type Translation as MowsTranslation,
    getBrowserLanguage as mowsGetBrowserLanguage
} from "@my-own-web-services/react-components/lib/languages";
import { SELECTED_LANGUAGE_LOCAL_STORAGE_KEY } from "./constants";

// eslint-disable-next-line quotes
declare module "@my-own-web-services/react-components/lib/languages" {
    interface Translation {
        resourceTags: {
            badges: string;
            text: string;
            selected: string;
            addToAll: string;
            removeFromAll: string;
            saveTextTags: string;
            cancel: string;
            searchPlaceholder: string;
            clearSearch: string;
        };
        upload: {
            dropFilesHere: string;
            dropFoldersHere: string;
            orClickToSelect: string;
            orClickToSelectFolder: string;
            selectFiles: string;
            removeFile: string;
            uploadFiles: string;
            dropFilesOrFoldersHere: string;
            orUseButtonsBelow: string;
            selectAll: string;
            selectFileGroup: string;
            dragToResize: string;
            showPreviews: string;
            status: {
                pending: string;
                uploading: string;
                completed: string;
                error: string;
            };
        };
        storageLocationPicker: {
            title: string;
            selectStorageLocation: string;
            noStorageLocationFound: string;
            loading: string;
        };
        storageQuotaPicker: {
            title: string;
            selectStorageQuota: string;
            noStorageQuotaFound: string;
            loading: string;
        };
        fileGroupPicker: {
            title: string;
            selectFileGroup: string;
            noFileGroupFound: string;
            loading: string;
        };
        fileGroupCreate: {
            createFileGroup: string;
            title: string;
            description: string;
            nameLabel: string;
            namePlaceholder: string;
            nameRequired: string;
            nameTooLong: string;
            createFailed: string;
            cancel: string;
            create: string;
            creating: string;
        };
        userGroupCreate: {
            createUserGroup: string;
            title: string;
            description: string;
            nameLabel: string;
            namePlaceholder: string;
            nameRequired: string;
            nameTooLong: string;
            createFailed: string;
            cancel: string;
            create: string;
            creating: string;
        };
        userGroupSettings: {
            title: string;
            nameLabel: string;
            nameRequired: string;
            nameTooLong: string;
            descriptionLabel: string;
            descriptionPlaceholder: string;
            descriptionTooLong: string;
            visibilityLabel: string;
            joinPolicyLabel: string;
            visibility: {
                private: string;
                listedRestricted: string;
                public: string;
            };
            joinPolicy: {
                inviteOnly: string;
                requestToJoin: string;
                openJoin: string;
            };
            updateFailed: string;
            cancel: string;
            save: string;
            saving: string;
        };
        userGroupPicker: {
            title: string;
            selectUserGroup: string;
            noUserGroupFound: string;
            loading: string;
            loadFailed: string;
        };
        userGroupList: {
            loading: string;
            empty: string;
            open: string;
            loadFailed: string;
            totalCount: (totalCount: number) => string;
            filters: {
                owned: string;
                member: string;
                invited: string;
                requested: string;
                serverListed: string;
                public: string;
            };
            visibility: {
                private: string;
                listedRestricted: string;
                public: string;
            };
            joinPolicy: {
                inviteOnly: string;
                requestToJoin: string;
                openJoin: string;
            };
        };
        userGroupDetail: {
            loading: string;
            working: string;
            noMembers: string;
            noInvitations: string;
            noJoinRequests: string;
            ownerBadge: string;
            removeMember: string;
            invite: string;
            inviteUserIdLabel: string;
            inviteUserIdPlaceholder: string;
            inviteMessageLabel: string;
            join: string;
            requestJoin: string;
            leave: string;
            deleteGroup: string;
            approve: string;
            reject: string;
            invitedOn: (when: string) => string;
            requestedOn: (when: string) => string;
            groupIdPrefix: string;
            userIdPrefix: string;
            errors: {
                loadMembers: string;
                loadInvitations: string;
                loadJoinRequests: string;
                invite: string;
                approve: string;
                reject: string;
                removeMember: string;
                leave: string;
                deleteGroup: string;
                requestJoin: string;
            };
            tabs: {
                members: string;
                invitations: string;
                requests: string;
            };
        };
        userGroupPendingDashboard: {
            loading: string;
            invitations: string;
            requests: string;
            noInvitations: string;
            noRequests: string;
            accept: string;
            decline: string;
            working: string;
            invitedOn: (when: string) => string;
            requestedOn: (when: string) => string;
            groupIdPrefix: string;
            errors: {
                load: string;
                accept: string;
                decline: string;
            };
        };
        jobsProgress: {
            title: string;
            inProgress: string;
            created: string;
            failed: string;
        };
        common: {
            files: {
                delete: (fileCount: number) => string;
            };
            jobs: {
                delete: (jobCount: number) => string;
            };
        };
        jobList: {
            columns: {
                name: string;
                status: string;
                app: string;
                created: string;
                modified: string;
            };
        };
    }
}

export type Translation = MowsTranslation;
export type Language = MowsLanguage;

export const languages: Language[] = [
    {
        code: `de`,
        originalName: `Deutsch`,
        englishName: `German`,
        emoji: `🇩🇪`,
        import: () => import(`./languages/de/default`)
    },
    {
        code: `en-US`,
        originalName: `English (US)`,
        englishName: `English (US)`,
        emoji: `🇺🇸`,
        import: () => import(`./languages/en-US/default`)
    }
];

export const getBrowserLanguage = (): Language => {
    return mowsGetBrowserLanguage(languages, SELECTED_LANGUAGE_LOCAL_STORAGE_KEY);
};
