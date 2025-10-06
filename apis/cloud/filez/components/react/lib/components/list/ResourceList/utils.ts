export const getSelectedItems = <ResourceType>(
    items: (ResourceType | undefined)[],
    selectedItems: (boolean | undefined)[]
): ResourceType[] => {
    return selectedItems.flatMap((selected, index) => {
        if (selected === true) {
            return items[index] ?? [];
        }
        return [];
    });
};

export const getSelectedCount = (selectedItems?: (boolean | undefined)[]) => {
    if (selectedItems === undefined) return 0;
    let count = 0;
    for (let i = 0; i < selectedItems.length; i++) {
        if (selectedItems[i] === true) {
            count++;
        }
    }

    return count;
};
