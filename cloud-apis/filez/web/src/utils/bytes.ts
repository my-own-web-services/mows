export const displayBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(0) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(0) + " MB";
    else return (bytes / 1073741824).toFixed(0) + " GB";
};
