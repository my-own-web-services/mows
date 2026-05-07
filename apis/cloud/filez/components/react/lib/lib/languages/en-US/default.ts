import baseEn from "mows-components-react/lib/languages/en-US/default";
import { CoreActionIds } from "mows-components-react/lib/mowsContext/coreActions";
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
