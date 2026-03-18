import crypto from "node:crypto";
import { CookieJar } from "tough-cookie";
import type { Cookie } from "tough-cookie";
import makeFetchCookie from "fetch-cookie";
import fs from "node:fs";
import path from "node:path";
import { logToFile } from "./logger.ts";
import { encrypt, decrypt, isEncryptionAvailable } from "./encryption.ts";

export type TwoFAMethod = "totp" | "emailOtp";

type Session = { jar: CookieJar };
const sessions = new Map<string, Session>();

const VRC_BASE = "https://api.vrchat.cloud/api/1";

// 環境変数でパス指定があればそちらを優先（Electron/Portable用）
// Dev mode: use worldnavi-sessions.json in release folder for consistency
const SESSION_FILE = process.env.VAM_SESSION_FILE
    ? path.resolve(process.env.VAM_SESSION_FILE)
    : path.resolve(process.cwd(), "..", "electron", "release", "worldnavi-sessions.json");

const USER_AGENT = "VRChatWorldManager/0.1";

function basicAuth(username: string, password: string) {
    const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    return `Basic ${token}`;
}

// jar固定fetch（ここが本命）
function getAuthedFetch(jar: CookieJar) {
    return makeFetchCookie(fetch, jar);
}

function loadSessions() {
    if (!fs.existsSync(SESSION_FILE)) return;

    try {
        const raw = fs.readFileSync(SESSION_FILE, "utf8");
        let jsonStr = raw;

        // 暗号化キーがある場合、復号を試みる
        if (isEncryptionAvailable()) {
            if (!raw.trim().startsWith("{")) {
                try {
                    jsonStr = decrypt(raw);
                } catch (e) {
                    logToFile(`[vrc] Failed to decrypt session file: ${e}`);
                    return;
                }
            } else {
                logToFile(`[vrc] Session file found but seems plain text. Will encrypt on next save.`);
            }
        }

        const data = JSON.parse(jsonStr) as Record<string, any>;
        let cleaned = 0;

        for (const [sid, jarJSON] of Object.entries(data)) {
            const cookies = jarJSON?.cookies ?? [];
            if (cookies.length === 0) {
                cleaned++;
                continue;
            }
            const jar = CookieJar.fromJSON(jarJSON);
            sessions.set(sid, { jar });
        }

        if (cleaned > 0) {
            logToFile(`[vrc] Cleaned up ${cleaned} empty sessions`);
            saveSessions();
        }
    } catch (e) {
        logToFile(`[vrc] Error loading sessions: ${e}`);
    }
}

function saveSessions() {
    const obj: Record<string, any> = {};
    for (const [sid, { jar }] of sessions.entries()) {
        obj[sid] = jar.toJSON();
    }

    let content = JSON.stringify(obj, null, 2);

    if (isEncryptionAvailable()) {
        try {
            content = encrypt(content);
        } catch (e) {
            logToFile(`[vrc] Failed to encrypt sessions: ${e}`);
            return;
        }
    }

    fs.writeFileSync(SESSION_FILE, content);
}

export function createSession() {
    const sid = crypto.randomUUID();
    const jar = new CookieJar();
    sessions.set(sid, { jar });
    saveSessions();
    return sid;
}

export function hasSession(sid: string) {
    return sessions.has(sid);
}

function getSession(sid: string) {
    const s = sessions.get(sid);
    if (!s) throw new Error("NO_SESSION");
    return s;
}

export function deleteSession(sid: string) {
    if (sessions.delete(sid)) {
        saveSessions();
    }
}

async function readJsonSafe(res: Response) {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

/**
 * ログイン（Basic認証で /auth/user）
 */
export async function vrcLogin(sid: string, username: string, password: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const res = await f(`${VRC_BASE}/auth/user`, {
        method: "GET",
        headers: {
            "User-Agent": USER_AGENT,
            Authorization: basicAuth(username, password),
        },
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
        return { ok: false as const, status: res.status, body: data };
    }

    const methods = (data?.requiresTwoFactorAuth ?? []) as TwoFAMethod[];
    if (methods.length > 0) {
        saveSessions();
        return { ok: true as const, state: "2fa_required" as const, methods };
    }
    saveSessions();
    return { ok: true as const, state: "logged_in" as const, user: data };
}

/** 2FA（Email/TOTP）verify */
export async function vrcVerify2FA(sid: string, method: TwoFAMethod, code: string) {
    logToFile(`[vrc] vrcVerify2FA start sid=${sid} method=${method}`);
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const verifyPath =
        method === "emailOtp"
            ? "/auth/twofactorauth/emailotp/verify"
            : "/auth/twofactorauth/totp/verify";

    logToFile(`[vrc] sending verify request to ${verifyPath}`);
    const res = await f(`${VRC_BASE}${verifyPath}`, {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
    });
    logToFile(`[vrc] verify response status=${res.status}`);

    const data = await readJsonSafe(res);
    if (!res.ok) {
        logToFile(`[vrc] verify failed: status=${res.status}`);
        return { ok: false as const, status: res.status, body: data };
    }

    logToFile(`[vrc] fetching me`);
    const meRes = await f(`${VRC_BASE}/auth/user`, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });
    logToFile(`[vrc] me response status=${meRes.status}`);

    const me = await readJsonSafe(meRes);
    if (!meRes.ok) {
        logToFile(`[vrc] me failed: status=${meRes.status}`);
        return { ok: false as const, status: meRes.status, body: me };
    }

    logToFile(`[vrc] saving sessions`);
    saveSessions();
    logToFile(`[vrc] 2FA success`);
    return { ok: true as const, user: me };
}

/** 自分の情報（ログイン生存確認用） */
export async function vrcGetMe(sid: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const res = await f(`${VRC_BASE}/auth/user`, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);

    if (!res.ok) {
        return { ok: false as const, status: res.status, body: data };
    }

    saveSessions();
    return { ok: true as const, user: data };
}

/** 最近訪問したワールド一覧 */
export async function vrcGetRecentWorlds(sid: string, n = 100, offset = 0) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url =
        `${VRC_BASE}/worlds/recent` +
        `?n=${encodeURIComponent(String(n))}` +
        `&offset=${encodeURIComponent(String(offset))}`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, worlds: data };
}

/** お気に入りワールド一覧 */
export async function vrcGetFavoriteWorlds(sid: string, n = 100, offset = 0, tag = "") {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    let url =
        `${VRC_BASE}/worlds/favorites` +
        `?n=${encodeURIComponent(String(n))}` +
        `&offset=${encodeURIComponent(String(offset))}`;

    if (tag) {
        url += `&tag=${encodeURIComponent(tag)}`;
    }

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, worlds: data };
}

/** 単一のワールド情報を取得（ID指定） */
export async function vrcGetWorldById(sid: string, worldId: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/worlds/${encodeURIComponent(worldId)}`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, world: data };
}

/** お気に入りグループ一覧（ワールド用） */
export async function vrcGetFavoriteWorldGroups(sid: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/favorite/groups?type=world&n=100`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, groups: data };
}

/** すべてのワールド検索 */
export async function vrcSearchWorlds(sid: string, query = "", sort = "relevance", n = 100, offset = 0) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    let url =
        `${VRC_BASE}/worlds` +
        `?n=${encodeURIComponent(String(n))}` +
        `&offset=${encodeURIComponent(String(offset))}` +
        `&releaseStatus=public` +
        `&sort=${encodeURIComponent(sort)}`;

    if (query) {
        url += `&search=${encodeURIComponent(query)}`;
    }

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, worlds: data };
}

/** ユーザーの所属グループ一覧取得 */
export async function vrcGetUserGroups(sid: string, userId: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/users/${encodeURIComponent(userId)}/groups`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, groups: data };
}

/** インスタンス作成 */
export async function vrcCreateInstance(sid: string, params: {
    worldId: string,
    type: string,
    region: string,
    ownerId?: string,
    groupId?: string,
    groupAccessType?: string,
    canRequestInvite?: boolean,
    capacity?: number
}) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/instances`;

    const res = await f(url, {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(params),
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, instance: data };
}

/** 自分に招待を送る */
export async function vrcInviteMyself(sid: string, worldId: string, instanceId: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/invite/myself/to/${encodeURIComponent(worldId)}:${encodeURIComponent(instanceId)}`;

    const res = await f(url, {
        method: "POST",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, result: data };
}

/** フレンド一覧取得 */
export async function vrcGetFriends(sid: string, offline = false) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/auth/user/friends?offline=${offline}&n=100`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, friends: data };
}

/** インバイトを送信 */
export async function vrcSendInvite(sid: string, userId: string, instanceId: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    // VRChat API: POST /invites/:userId
    const url = `${VRC_BASE}/invite/${encodeURIComponent(userId)}`;

    const res = await f(url, {
        method: "POST",
        headers: {
            "User-Agent": USER_AGENT,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ instanceId }),
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, result: data };
}

/** インスタンス詳細取得（ユーザー一覧を含む） */
export async function vrcGetInstance(sid: string, worldId: string, instanceId: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/instances/${encodeURIComponent(worldId)}:${encodeURIComponent(instanceId)}`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, instance: data };
}

/** インスタンスの短縮名情報を取得（予備） */
export async function vrcGetInstanceShortName(sid: string, worldId: string, instanceId: string) {
    const { jar } = getSession(sid);
    const f = getAuthedFetch(jar);

    const url = `${VRC_BASE}/instances/${encodeURIComponent(worldId)}:${encodeURIComponent(instanceId)}/shortName`;

    const res = await f(url, {
        method: "GET",
        headers: { "User-Agent": USER_AGENT },
    });

    const data = await readJsonSafe(res);
    if (!res.ok) return { ok: false as const, status: res.status, body: data };

    return { ok: true as const, result: data };
}

loadSessions();
