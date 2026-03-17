import type { CustomList } from "./types";

const API = (window as any).VAM_API_URL || "http://localhost:8787";

type Settings = {
    // 将来の拡張用に設定構造を維持
    [key: string]: any;
};

let cache: Settings = {};

let settingsLoaded = false;

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 500;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export function isSettingsLoaded(): boolean {
    return settingsLoaded;
}

export async function fetchSettings(): Promise<Settings> {
    try {
        const res = await fetch(`${API}/settings`);
        if (res.ok) {
            const data = await res.json();
            cache = { ...cache, ...data };
        }
    } catch (e) {
        console.error("Failed to load settings", e);
    }
    settingsLoaded = true;
    return cache;
}

async function saveWithRetry(data: Settings, retries = MAX_RETRIES): Promise<boolean> {
    try {
        const res = await fetch(`${API}/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return true;
    } catch (e) {
        console.error(`Failed to save settings (remaining retries: ${retries})`, e);
        if (retries > 0) {
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            return saveWithRetry(data, retries - 1);
        }
        return false;
    }
}

function pushSettingsDebounced() {
    if (!settingsLoaded) {
        console.log("Settings not loaded yet, skipping save");
        return;
    }

    if (saveTimer) {
        clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(async () => {
        const success = await saveWithRetry({ ...cache });
        if (!success) {
            console.error("Failed to save settings after all retries");
        }
    }, DEBOUNCE_MS);
}

// --- Custom Lists ---
export function getCustomLists(): CustomList[] {
    return cache.customLists || [];
}

export function saveCustomLists(lists: CustomList[]) {
    cache.customLists = lists;
    pushSettingsDebounced();
}

// --- World Tags ---
export function getWorldTags(): Record<string, string[]> {
    return cache.worldTags || {};
}

export function saveWorldTags(tags: Record<string, string[]>) {
    cache.worldTags = tags;
    pushSettingsDebounced();
}

// --- VRChat Log Path ---
export function getVrcLogPath(): string {
    return cache.vrcLogPath || "";
}

export function saveVrcLogPath(path: string) {
    cache.vrcLogPath = path;
    pushSettingsDebounced();
}

// --- Theme ---
export function getTheme(): "light" | "dark" {
    return cache.theme || "light";
}

export function saveTheme(theme: "light" | "dark") {
    cache.theme = theme;
    pushSettingsDebounced();
}

// --- Import / Export ---
export function exportStorage(): string {
    return JSON.stringify(cache, null, 2);
}

export async function importStorage(json: string): Promise<boolean> {
    try {
        const data = JSON.parse(json);
        if (typeof data !== "object" || data === null) return false;
        
        cache = { ...data };
        pushSettingsDebounced();
        return true;
    } catch (e) {
        console.error("Failed to import settings", e);
        return false;
    }
}
