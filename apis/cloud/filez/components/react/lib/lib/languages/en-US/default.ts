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
        [ActionIds.CREATE_FILE_GROUP]: `Create file group`,
        [ActionIds.OPEN_DEV_TOOLS]: `Open developer tools`
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
    },
    devPanel: {
        tasks: {
            title: `Tasks`,
            description: `Search, run, and monitor development tasks`,
            searchPlaceholder: `Search tasks...`,
            runAllTitle: `Run All Tasks`,
            runAllButton: `Run All Tasks`,
            running: `Running...`,
            individualTitle: `Individual Tasks`,
            noTasksFound: `No tasks found matching`,
            tasksCount: `tasks`
        },
        apiTests: {
            title: `API Tests`,
            description: `Search, run, and monitor API integration tests`,
            searchPlaceholder: `Search tests...`,
            runAllTitle: `Run All Tests`,
            runAllButton: `Run All Tests`,
            running: `Running...`,
            individualTitle: `Individual Tests`,
            noTestsFound: `No tests found matching`,
            testsCount: `tests`,
            runMode: {
                sequential: `Sequential (one at a time)`,
                parallel: `Parallel (all at once)`
            }
        },
        status: {
            idle: `Idle`,
            running: `Running`,
            success: `Success`,
            error: `Error`
        }
    },
    loggingConfig: {
        title: `Logging Configuration`,
        description: `Configure logging levels and file-specific filters`,
        defaultLevel: `Default Log Level`,
        fileFilters: `File-Specific Filters`,
        noFileFilters: `No file-specific filters configured`,
        addFileFilter: `Add File Filter`,
        filePatternPlaceholder: `e.g., HotkeyManager, FileViewer`,
        remove: `Remove`,
        add: `Add`
    },
    devTools: {
        title: `Developer Tools`,
        description: `Development tasks, API tests, and logging configuration`
    },
    resourceList: {
        reload: `Reload`
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
