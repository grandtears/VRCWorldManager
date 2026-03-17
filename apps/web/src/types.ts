export type State = "boot" | "idle" | "2fa_required" | "logged_in";
export type TwoFAMethod = "totp" | "emailOtp";

export type World = {
    id: string;
    name: string;
    thumbnail: string;
    authorName: string;
    capacity: number;
    visits: number;
    favorites: number;
    tags: string[];
    description?: string;
    updatedAt?: string;
    createdAt?: string;
    platforms?: string[];
};

export type FavoriteGroup = {
    id: string;
    name: string;
    displayName: string;
};

export type ViewTab = "recent" | "favorites";

export type CustomList = {
    id: string;
    name: string;
    worlds: World[];
};

export type Group = {
    id: string;
    name: string;
    shortCode: string;
    discriminator: string;
    description: string;
    iconUrl?: string;
    bannerUrl?: string;
    ownerId: string;
    memberCount: number;
    visibility: string;
    groupId?: string;
};

export type Friend = {
    id: string; // userId
    displayName: string;
    userIcon: string;
    profilePicOverride: string;
    status: string;
    statusDescription: string;
    currentPlatform: string;
    isFriend?: boolean;
    location: string; // wrld_id:instance_id or "private" or "offline"
};

export interface LogHistoryEntry {
    worldId: string;
    instanceId: string;
    worldName: string;
    timestamp: string;
}
