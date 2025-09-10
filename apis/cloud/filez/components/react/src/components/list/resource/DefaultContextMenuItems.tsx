export const defaultMenuItems: MenuItems = {
    log: {
        label: "Log to console"
    },
    delete: {
        label: "Delete"
    },
    edit: {
        label: "Edit"
    }
};

export interface MenuItems {
    readonly [key: string]: MenuItem;
}

export interface MenuItem {
    label: string;
}
