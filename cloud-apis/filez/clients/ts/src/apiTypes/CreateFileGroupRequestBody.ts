// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { FileGroupType } from "./FileGroupType";
import type { FilterRule } from "./FilterRule";

export interface CreateFileGroupRequestBody { name: string | null, keywords: Array<string>, mime_types: Array<string>, group_hierarchy_paths: Array<string>, group_type: FileGroupType, dynamic_group_rules: FilterRule | null, permission_ids: Array<string>, }