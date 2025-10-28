import { ActionIds } from "@/lib/defaultActions";
import type { Translation } from "@/lib/languages";

const translation: Translation = {
    primaryMenu: {
        loggedInAs: `Signed in as`,
        copyUserId: {
            label: `Copy User ID`,
            title: `Copy User ID to clipboard`
        },
        profile: `Profile`,
        language: `Language`,
        login: `Login`,
        logout: `Logout`,
        theme: `Theme`,
        openMenu: `Open menu`,
        switchUser: `Switch User`,
        developerTools: `Developer Tools`,
        developer: `Developer`
    },
    languagePicker: {
        title: `Language Selector`,
        noLanguageFound: `No language found`,
        selectLanguage: `Select language`
    },
    themePicker: {
        title: `Theme Selector`,
        selectTheme: `Select theme`,
        noThemeFound: `No theme found`
    },
    keyboardShortcuts: {
        label: `Keyboard Shortcuts`,
        title: `Keyboard Shortcuts`,
        resetAll: `Reset All`,
        edit: `Edit`,
        reset: `Reset`,
        delete: `Delete`,
        hotkeyDialog: {
            editTitle: `Edit Keyboard Shortcut`,
            addTitle: `Add New Hotkey`,
            editDescription: `Press the key combination you want to use for this action.`,
            addDescription: `Add a new hotkey for`,
            pressKeys: `Press keys...`,
            cancel: `Cancel`,
            save: `Save`,
            addHotkey: `Add Hotkey`,
            keyAlreadyInUse: `This combination is already used by "{action}"`
        }
    },
    actions: {
        [ActionIds.OPEN_COMMAND_PALETTE]: `Open command palette`,
        [ActionIds.OPEN_KEYBOARD_SHORTCUTS]: `Open keyboard shortcuts`,
        [ActionIds.OPEN_LANGUAGE_SETTINGS]: `Open language settings`,
        [ActionIds.OPEN_THEME_SELECTOR]: `Open theme selector`,
        [ActionIds.OPEN_PRIMARY_MENU]: `Open primary menu`,
        [ActionIds.LOGIN]: `Login`,
        [ActionIds.LOGOUT]: `Logout`,
        [ActionIds.DELETE_FILES]: `Delete files`,
        [ActionIds.CREATE_FILE_GROUP]: `Create file group`
    },
    commandPalette: {
        placeholder: `Type a command or search...`,
        noResults: `No results found.`,
        suggestions: `Suggestions`,
        recentCommands: `Recent Commands`
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
            delete: (fileCount: number) => fileCount === 1 ? `Delete file` : `Delete ${fileCount} files`
        }
    }
};

export default translation;
