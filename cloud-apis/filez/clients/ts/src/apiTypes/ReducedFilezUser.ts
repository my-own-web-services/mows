// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { FriendshipStatus } from "./FriendshipStatus";
import type { UserRole } from "./UserRole";
import type { UserStatus } from "./UserStatus";
import type { UserVisibility } from "./UserVisibility";

export interface ReducedFilezUser { _id: string, name: string | null, friendship_status: FriendshipStatus, status: UserStatus, visibility: UserVisibility, role: UserRole, shared_user_groups: Array<string>, }