import { SortOrder } from "./apiTypes/SortOrder";

export interface ProcessedImage {
    width: number;
    height: number;
    resolutions: number[];
}

export interface GetResourceParams {
    id?: string;
    from_index?: number;
    limit?: number | null;
    sort_field?: string | null;
    sort_order?: SortOrder | null;
    filter?: string | null;
}

export interface GetFileOptions {
    range?: { from: number; to: number };
    cache?: boolean;
}
