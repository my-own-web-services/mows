export declare const testCreateFile: () => Promise<void>;
export declare const deleteFile: (id: string) => Promise<boolean>;
export declare const getFile: (id: string) => Promise<string>;
export interface CreatedFileResponse {
    fileId: string;
    storageName: string;
    sha256: string;
}
export declare const createFile: () => Promise<CreatedFileResponse>;
export declare const setupDb: () => Promise<void>;
