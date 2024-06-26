// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { UsageLimits } from "./UsageLimits";
import type { UserRole } from "./UserRole";
import type { UserStatus } from "./UserStatus";
import type { UserVisibility } from "./UserVisibility";

export interface FilezUser { _id: string, ir_user_id: string | null, name: string | null, email: string | null, role: UserRole, visibility: UserVisibility, friends: Array<string>, pending_incoming_friend_requests: Array<string>, status: UserStatus, app_data: Record<string, any>, limits: Record<string, UsageLimits | null>, user_group_ids: Array<string>, permission_ids: Array<string>, creator_id: string | null, }