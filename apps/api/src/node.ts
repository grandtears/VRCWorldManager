import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCookie, setCookie } from "hono/cookie";
import { serve } from "@hono/node-server";

import {
    createSession,
    hasSession,
    vrcGetRecentWorlds,
    vrcGetFavoriteWorlds,
    vrcGetFavoriteWorldGroups,
    vrcSearchWorlds,
    vrcLogin,
    vrcVerify2FA,
    vrcGetMe,
    vrcGetUserGroups,
    vrcCreateInstance,
    vrcInviteMyself,
    vrcGetFriends,
    vrcSendInvite,
    vrcGetInstance,
    vrcGetInstanceShortName,
    deleteSession,
    vrcGetWorldById,
    type TwoFAMethod
} from "./vrc.ts";
import { logToFile } from "./logger.ts";
import { updateLogData, getLogPlayers, setVrcLogPath, getCurrentLogWorldName, getLogHistory } from "./vrc-log.ts";

type Env = {
    Variables: {
        sid: string;
    };
};

const app = new Hono<Env>();

// CORS（Viteから叩く）
app.use(
    "*",
    cors({
        origin: (origin) => {
            if (!origin || origin === "null" || origin.startsWith("file://")) {
                return origin || "*";
            }
            if (origin.startsWith("http://localhost")) {
                return origin;
            }
            return origin;
        },
        credentials: true
    })
);

// sid cookie（サーバ側セッション）
const SID_TTL_SEC = 60 * 60 * 24 * 30; // 30日
app.use("*", async (c, next) => {
    const incoming = getCookie(c, "sid");

    let sid = incoming;
    if (!sid || !hasSession(sid)) {
        sid = createSession();

        setCookie(c, "sid", sid, {
            httpOnly: true,
            sameSite: "Lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30,
        });
    }

    c.set("sid", sid);
    await next();
});

// Settings Persistence
import fs from "node:fs";
import path from "node:path";
const SETTINGS_FILE = process.env.VAM_SETTINGS_FILE
    ? path.resolve(process.env.VAM_SETTINGS_FILE)
    : path.resolve(process.cwd(), "..", "electron", "release", "avaclo-settings.json");

const SETTINGS_BACKUP = SETTINGS_FILE + ".bak";
const SETTINGS_TEMP = SETTINGS_FILE + ".tmp";

function loadSettings() {
    // メインファイルを試す
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            const content = fs.readFileSync(SETTINGS_FILE, "utf8");
            const data = JSON.parse(content);
            // 有効なデータかチェック
            if (data && typeof data === "object") {
                if (data.vrcLogPath) setVrcLogPath(data.vrcLogPath);
                return data;
            }
        } catch (e) {
            console.error("Failed to load settings from main file:", e);
        }
    }

    // メインファイルが壊れている/存在しない場合、バックアップを試す
    if (fs.existsSync(SETTINGS_BACKUP)) {
        try {
            const content = fs.readFileSync(SETTINGS_BACKUP, "utf8");
            const data = JSON.parse(content);
            if (data && typeof data === "object") {
                console.log("Restored settings from backup file");
                // バックアップからメインを復元
                fs.writeFileSync(SETTINGS_FILE, content);
                return data;
            }
        } catch (e) {
            console.error("Failed to load settings from backup:", e);
        }
    }

    return {};
}

function saveSettings(data: any) {
    try {
        const content = JSON.stringify(data, null, 2);

        // 1. 既存ファイルがあればバックアップを作成
        if (fs.existsSync(SETTINGS_FILE)) {
            try {
                fs.copyFileSync(SETTINGS_FILE, SETTINGS_BACKUP);
            } catch (e) {
                console.error("Failed to create backup:", e);
            }
        }

        // 2. 一時ファイルに書き込み（アトミック書き込み準備）
        fs.writeFileSync(SETTINGS_TEMP, content);

        // 3. 一時ファイルをメインファイルにリネーム（アトミック）
        fs.renameSync(SETTINGS_TEMP, SETTINGS_FILE);

    } catch (e) {
        console.error("Failed to save settings:", e);
        try {
            if (fs.existsSync(SETTINGS_TEMP)) {
                fs.unlinkSync(SETTINGS_TEMP);
            }
        } catch { }
        throw e;
    }
}

// Settings Endpoints
app.get("/settings", (c) => {
    return c.json(loadSettings());
});
app.post("/settings", async (c) => {
    try {
        const data = await c.req.json();
        if (data.vrcLogPath !== undefined) setVrcLogPath(data.vrcLogPath);
        saveSettings(data);
        return c.json({ ok: true });
    } catch (e) {
        return c.json({ ok: false, error: "Failed to save settings" }, 500);
    }
});

// 起動確認
app.get("/health", (c) => c.json({ ok: true }));

/** ログイン **/
app.post("/auth/login", async (c) => {
    const { username, password } = await c.req.json<{ username: string; password: string }>();
    const sid = c.get("sid");

    const r = await vrcLogin(sid, username, password);

    if (!r.ok) return c.json({ ok: false, status: r.status, body: r.body }, { status: 401 as const });

    if (r.state === "2fa_required") {
        return c.json({ ok: true, state: "2fa_required", methods: r.methods });
    }

    return c.json({
        ok: true,
        state: "logged_in",
        displayName: (r.user as any)?.displayName ?? "",
        userId: (r.user as any)?.id ?? ""
    });
});
/** 2FA **/
app.post("/auth/2fa", async (c) => {
    const { method, code } = await c.req.json<{ method: TwoFAMethod; code: string }>();
    const sid = c.get("sid");
    logToFile(`[node] 2FA request sid=${sid}`);

    const r = await vrcVerify2FA(sid, method, code);
    logToFile(`[node] 2FA result ok=${r.ok}`);

    if (!r.ok) return c.json({ ok: false, status: r.status, body: r.body }, 401);

    return c.json({
        ok: true,
        state: "logged_in",
        displayName: (r.user as any)?.displayName ?? ""
    });
});

/** ログアウト（sid のセッション破棄 + cookie削除） */
app.post("/auth/logout", async (c) => {
    const sid = c.get("sid");

    deleteSession(sid);

    setCookie(c, "sid", "", {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: 0,
    });

    return c.json({ ok: true });
});

/** 最近訪問したワールド一覧 */
app.get("/worlds/recent", async (c) => {
    const sid = c.get("sid");

    const n = Number(c.req.query("n") ?? "100");
    const offset = Number(c.req.query("offset") ?? "0");

    const safeN = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 100;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

    try {
        const r = await vrcGetRecentWorlds(sid, safeN, safeOffset);

        if (!r.ok) {
            return c.json({ ok: false, status: r.status, body: r.body }, 401);
        }

        const isPrivate = (w: any) => w.name === "???" && (w.authorName === "???" || !w.authorName);

        const worlds = (r.worlds ?? [])
            .filter((w: any) => !isPrivate(w))
            .map((w: any) => ({
                id: w.id,
                name: w.name,
                thumbnail: w.thumbnailImageUrl,
                authorName: w.authorName ?? "",
                capacity: w.capacity ?? 0,
                visits: w.visits ?? 0,
                favorites: w.favorites ?? 0,
                tags: w.tags ?? [],
                description: w.description ?? "",
                updatedAt: w.updated_at,
                createdAt: w.created_at,
                platforms: (w.unityPackages ?? []).map((p: any) => p.platform),
            }));

        const hasMore = (r.worlds?.length ?? 0) === safeN;

        return c.json({ ok: true, worlds, offset: safeOffset, n: safeN, hasMore });
    } catch {
        return c.json({ ok: false, error: "WORLDS_FAILED" }, 500);
    }
});

/** お気に入りワールド一覧 */
app.get("/worlds/favorites", async (c) => {
    const sid = c.get("sid");

    const n = Number(c.req.query("n") ?? "100");
    const offset = Number(c.req.query("offset") ?? "0");
    const tag = c.req.query("tag") ?? "";

    const safeN = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 100;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

    try {
        const r = await vrcGetFavoriteWorlds(sid, safeN, safeOffset, tag);

        if (!r.ok) {
            return c.json({ ok: false, status: r.status, body: r.body }, 401);
        }

        const isPrivate = (w: any) => w.name === "???" && (w.authorName === "???" || !w.authorName);

        const worlds = (r.worlds ?? [])
            .filter((w: any) => !isPrivate(w))
            .map((w: any) => ({
                id: w.id,
                name: w.name,
                thumbnail: w.thumbnailImageUrl,
                authorName: w.authorName ?? "",
                capacity: w.capacity ?? 0,
                visits: w.visits ?? 0,
                favorites: w.favorites ?? 0,
                tags: w.tags ?? [],
                description: w.description ?? "",
                updatedAt: w.updated_at,
                createdAt: w.created_at,
                platforms: (w.unityPackages ?? []).map((p: any) => p.platform),
            }))
            .sort((a: any, b: any) => {
                const dateA = new Date(a.updatedAt || 0).getTime();
                const dateB = new Date(b.updatedAt || 0).getTime();
                return dateB - dateA;
            });

        const hasMore = (r.worlds?.length ?? 0) === safeN;

        return c.json({ ok: true, worlds, offset: safeOffset, n: safeN, hasMore });
    } catch {
        return c.json({ ok: false, error: "FAVORITES_FAILED" }, 500);
    }
});

/** お気に入りグループ一覧（ワールド） */
app.get("/worlds/favorite-groups", async (c) => {
    const sid = c.get("sid");

    try {
        const r = await vrcGetFavoriteWorldGroups(sid);

        if (!r.ok) {
            return c.json({ ok: false, status: r.status, body: r.body }, 401);
        }

        const groups = (r.groups ?? []).map((g: any) => ({
            id: g.id,
            name: g.name,
            displayName: g.displayName ?? g.name,
        }));

        return c.json({ ok: true, groups });
    } catch {
        return c.json({ ok: false, error: "GROUPS_FAILED" }, 500);
    }
});

/** すべてのワールド検索 */
app.get("/worlds/search", async (c) => {
    const sid = c.get("sid");

    const n = Number(c.req.query("n") ?? "100");
    const offset = Number(c.req.query("offset") ?? "0");
    const query = c.req.query("search") ?? "";
    const sort = c.req.query("sort") ?? "relevance";

    const safeN = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 100;
    const safeOffset = Number.isFinite(offset) ? Math.max(offset, 0) : 0;

    try {
        // もしクエリがワールドID（wrld_...）なら、直接取得を試みる
        if (query.startsWith("wrld_")) {
            const r = await vrcGetWorldById(sid, query);
            if (r.ok && r.world) {
                const w = r.world as any;
                const world = {
                    id: w.id,
                    name: w.name,
                    thumbnail: w.thumbnailImageUrl,
                    authorName: w.authorName ?? "",
                    capacity: w.capacity ?? 0,
                    visits: w.visits ?? 0,
                    favorites: w.favorites ?? 0,
                    tags: w.tags ?? [],
                    description: w.description ?? "",
                    updatedAt: w.updated_at,
                    createdAt: w.created_at,
                    platforms: (w.unityPackages ?? []).map((p: any) => p.platform),
                };
                return c.json({ ok: true, worlds: [world], offset: 0, n: 1, hasMore: false });
            }
        }

        const r = await vrcSearchWorlds(sid, query, sort, safeN, safeOffset);

        if (!r.ok) {
            return c.json({ ok: false, status: r.status, body: r.body }, 401);
        }

        const isPrivate = (w: any) => w.name === "???" && (w.authorName === "???" || !w.authorName);

        const worlds = (r.worlds ?? [])
            .filter((w: any) => !isPrivate(w))
            .map((w: any) => ({
                id: w.id,
                name: w.name,
                thumbnail: w.thumbnailImageUrl,
                authorName: w.authorName ?? "",
                capacity: w.capacity ?? 0,
                visits: w.visits ?? 0,
                favorites: w.favorites ?? 0,
                tags: w.tags ?? [],
                description: w.description ?? "",
                updatedAt: w.updated_at,
                createdAt: w.created_at,
                platforms: (w.unityPackages ?? []).map((p: any) => p.platform),
            }));

        const hasMore = (r.worlds?.length ?? 0) === safeN;

        return c.json({ ok: true, worlds, offset: safeOffset, n: safeN, hasMore });
    } catch {
        return c.json({ ok: false, error: "SEARCH_FAILED" }, 500);
    }
});

/** 単一のワールド取得 (ID) */
app.get("/worlds/id/:id", async (c) => {
    const sid = c.get("sid");
    const id = c.req.param("id");

    try {
        const r = await vrcGetWorldById(sid, id);
        if (!r.ok) {
            return c.json({ ok: false, status: r.status, body: r.body }, 404);
        }

        const w = r.world as any;
        const world = {
            id: w.id,
            name: w.name,
            thumbnail: w.thumbnailImageUrl,
            authorName: w.authorName ?? "",
            capacity: w.capacity ?? 0,
            visits: w.visits ?? 0,
            favorites: w.favorites ?? 0,
            tags: w.tags ?? [],
            description: w.description ?? "",
            updatedAt: w.updated_at,
            createdAt: w.created_at,
            platforms: (w.unityPackages ?? []).map((p: any) => p.platform),
        };

        return c.json({ ok: true, world });
    } catch {
        return c.json({ ok: false, error: "GET_WORLD_FAILED" }, 500);
    }
});

/** 所属グループ一覧 */
app.get("/groups", async (c) => {
    const sid = c.get("sid");
    const userId = c.req.query("userId");
    if (!userId) return c.json({ ok: false, error: "userId is required" }, 400);

    const r = await vrcGetUserGroups(sid, userId);
    if (!r.ok) return c.json({ ok: false, status: r.status, body: r.body }, 401);

    return c.json({ ok: true, groups: r.groups });
});

/** インスタンス作成 */
app.post("/instances/create", async (c) => {
    const sid = c.get("sid");
    const params = await c.req.json();

    const r = await vrcCreateInstance(sid, params);
    if (!r.ok) return c.json({ ok: false, status: r.status, body: r.body }, (r.status as any) || 401);

    return c.json({ ok: true, instance: r.instance });
});

/** 自分に招待を送る */
app.post("/instances/invite-myself", async (c) => {
    const sid = c.get("sid");
    const { worldId, instanceId } = await c.req.json();

    const r = await vrcInviteMyself(sid, worldId, instanceId);
    if (!r.ok) return c.json({ ok: false, status: r.status, body: r.body }, (r.status as any) || 401);

    return c.json({ ok: true, result: r.result });
});

/** フレンド一覧 */
app.get("/friends", async (c) => {
    const sid = c.get("sid");
    const offline = c.req.query("offline") === "true";
    const r = await vrcGetFriends(sid, offline);
    if (!r.ok) return c.json({ ok: false, status: r.status, body: r.body }, (r.status as any) || 401);
    return c.json({ ok: true, friends: r.friends });
});

/** 現在のインスタンスにいるユーザー（及び参加者全員）一覧 */
app.get("/instances/current/users", async (c) => {
    const sid = c.get("sid");

    // 1. 自分の現在地を取得 (presenceから正確なIDを得る)
    const me = await vrcGetMe(sid);
    updateLogData();
    if (!me.ok) return c.json({ ok: false }, 401);
    
    const presence = (me.user as any).presence;
    if (!presence || !presence.world || !presence.instance || presence.instance === "offline" || presence.instance === "private") {
        return c.json({ ok: true, users: [] });
    }

    const worldId = presence.world;
    const instanceId = presence.instance;

    // 2. インスタンス情報を取得
    const r = await vrcGetInstance(sid, worldId, instanceId);
    if (r.ok) {
        const users = (r.instance.users || []).map((u: any) => ({
            id: u.id,
            displayName: u.displayName,
            userIcon: u.currentAvatarThumbnailImageUrl,
            isFriend: u.isFriend,
            status: u.status,
            currentAvatarThumbnailImageUrl: u.currentAvatarThumbnailImageUrl,
        }));

        const usersMap = new Map<string, any>();
        users.forEach(u => usersMap.set(u.id, u));

        // ログから取得した参加者もマージ
        const logPlayers = getLogPlayers();
        logPlayers.forEach(p => {
            if (!usersMap.has(p.id)) {
                usersMap.set(p.id, {
                    id: p.id,
                    displayName: p.displayName,
                    userIcon: null,
                    currentAvatarThumbnailImageUrl: null,
                    isFriend: false,
                    status: "active",
                });
            }
        });

        return c.json({ ok: true, users: Array.from(usersMap.values()) });
    }

    // インスタンス情報の取得に失敗（権限不足など）した場合はフォールバックとしてフレンド一覧から
    const fr = await vrcGetFriends(sid, false);
    if (fr.ok) {
        const myLocation = `${worldId}:${instanceId}`;
        const sameLocationFriends = fr.friends.filter((f: any) => f.location === myLocation);
        return c.json({ ok: true, users: sameLocationFriends });
    }

    return c.json({ ok: false, status: r.status, body: r.body }, (r.status as any) || 401);
});

/** 現在のインスタンスの詳細情報（作成時間など） */
app.get("/instances/current/details", async (c) => {
    const sid = c.get("sid");
    updateLogData();

    // 1. 自分の情報を取得
    const me = await vrcGetMe(sid);
    if (!me.ok) return c.json({ ok: false }, 401);
    
    const presence = (me.user as any).presence;
    if (!presence || !presence.world || !presence.instance || presence.instance === "offline" || presence.instance === "private") {
        return c.json({ ok: false, error: "NOT_IN_INSTANCE" });
    }

    const worldId = presence.world;
    const instanceId = presence.instance;
    const myLocation = `${worldId}:${instanceId}`;

    // 2. インスタンス情報を取得
    const r = await vrcGetInstance(sid, worldId, instanceId);
    if (!r.ok) return c.json({ ok: false, error: "FETCH_FAILED" }, 401);

    // デバッグログ: インスタンス情報の全プロパティを確認
    logToFile(`[node] instance details: ${JSON.stringify(r.instance)}`);
    
    // shortName APIも試す
    const sr = await vrcGetInstanceShortName(sid, worldId, instanceId);
    if (sr.ok) {
        logToFile(`[node] instance shortName result: ${JSON.stringify(sr.result)}`);
    }

    // 3. フレンド一覧を取得（参加者リストの補完用）
    const fr = await vrcGetFriends(sid, false);
    const friendsAtLocation = fr.ok 
        ? fr.friends.filter((f: any) => f.location === myLocation)
        : [];

    // 4. 参加者リストの構築
    // APIがusersを返さない場合があるため、自分自身 + 同じ場所にいるフレンドを合成する
    const usersMap = new Map();

    const myId = me.user.id || (me.user as any).userId;
    const myName = me.user.displayName;
    const myIcon = me.user.currentAvatarThumbnailImageUrl || (me.user as any).userIcon;

    // 自分を追加
    if (myId) {
        usersMap.set(myId, {
            id: myId,
            displayName: myName,
            userIcon: myIcon,
            currentAvatarThumbnailImageUrl: myIcon,
            isFriend: false,
            status: me.user.status || "active",
        });
    }

    // フレンドを追加
    friendsAtLocation.forEach((f: any) => {
        usersMap.set(f.id, {
            id: f.id,
            displayName: f.displayName,
            userIcon: f.currentAvatarThumbnailImageUrl,
            currentAvatarThumbnailImageUrl: f.currentAvatarThumbnailImageUrl,
            isFriend: true,
            status: f.status,
        });
    });

    // APIがusersを返した場合は、それらもマージ（非フレンドが見える場合用）
    if (r.instance.users && Array.isArray(r.instance.users)) {
        r.instance.users.forEach((u: any) => {
            if (!usersMap.has(u.id)) {
                usersMap.set(u.id, {
                    id: u.id,
                    displayName: u.displayName,
                    userIcon: u.currentAvatarThumbnailImageUrl,
                    currentAvatarThumbnailImageUrl: u.currentAvatarThumbnailImageUrl,
                    isFriend: u.isFriend,
                    status: u.status,
                });
            }
        });
    }

    // ログから取得した参加者もマージ
    const logPlayers = getLogPlayers();
    logPlayers.forEach(p => {
        if (!usersMap.has(p.id)) {
            usersMap.set(p.id, {
                id: p.id,
                displayName: p.displayName,
                userIcon: null,
                currentAvatarThumbnailImageUrl: null,
                isFriend: false,
                status: "active",
            });
        }
    });

    // 作成時間の特定
    // tagsの中に "created:..." (UNIXタイムスタンプ) が入っている
    let createdAt = r.instance.created_at || null;
    if (r.instance.tags && Array.isArray(r.instance.tags)) {
        const createdTag = r.instance.tags.find((t: string) => t.startsWith("created:"));
        if (createdTag) {
            const ts = createdTag.split(":")[1];
            if (ts) {
                createdAt = new Date(Number(ts) * 1000).toISOString();
            }
        }
    }
    // それでも取れない場合の予備
    if (!createdAt && r.instance.active) createdAt = r.instance.active;

    const usersList = Array.from(usersMap.values());
    logToFile(`[node] usersMap count: ${usersMap.size}, usersList: ${JSON.stringify(usersList)}`);

    const result = { 
        ok: true, 
        instance: {
            id: r.instance.id,
            name: r.instance.name || getCurrentLogWorldName(), // VRC APIが返さない場合はログから
            worldName: getCurrentLogWorldName() || r.instance.name, // 明示的に別フィールドでも返す
            createdAt: createdAt,
            userCount: r.instance.userCount || r.instance.n_users || usersList.length,
            n_users: r.instance.n_users || r.instance.userCount || usersList.length,
            users: usersList
        }
    };
    logToFile(`[node] final result users count: ${result.instance.users.length}`);
    return c.json(result);
});

/** ログから取得した訪問履歴 */
app.get("/instances/log-history", async (c) => {
    updateLogData();
    return c.json({ ok: true, history: getLogHistory() });
});

/** インバイト送信（一括対応可） */
app.post("/instances/invite", async (c) => {
    const sid = c.get("sid");
    const { userIds, instanceId } = await c.req.json();

    if (!Array.isArray(userIds)) return c.json({ ok: false }, 400);

    const results = [];
    for (const uid of userIds) {
        const r = await vrcSendInvite(sid, uid, instanceId);
        results.push({ userId: uid, ok: r.ok });
    }

    return c.json({ ok: true, results });
});

/* ログイン済みか？ */
app.get("/auth/me", async (c) => {
    const sid = c.get("sid");
    const r = await vrcGetMe(sid);

    return c.json({
        ok: true,
        displayName: (r.user as any)?.displayName ?? "",
        userId: (r.user as any)?.id ?? "",
    });
});

// Static file serving for production (Electron)
const WEB_DIR = process.env.VAM_WEB_DIR;
if (WEB_DIR) {
    const fsSync = require("node:fs");
    const pathSync = require("node:path");

    // Serve static files
    app.get("*", async (c) => {
        const urlPath = c.req.path === "/" ? "/index.html" : c.req.path;
        // 安全なパス解決
        const forbidden = urlPath.includes("..") || urlPath.includes(":");
        if (forbidden) return c.notFound();

        const filePath = pathSync.join(WEB_DIR, urlPath);

        // ディレクトリトラバーサル対策: 解決後のパスが WEB_DIR 内にあるか確認
        if (!filePath.startsWith(WEB_DIR)) {
            return c.notFound();
        }

        try {
            const stat = fsSync.statSync(filePath);
            if (stat.isFile()) {
                const content = fsSync.readFileSync(filePath);
                const ext = pathSync.extname(filePath).toLowerCase();
                const mimeTypes: Record<string, string> = {
                    ".html": "text/html",
                    ".js": "application/javascript",
                    ".css": "text/css",
                    ".json": "application/json",
                    ".png": "image/png",
                    ".jpg": "image/jpeg",
                    ".svg": "image/svg+xml",
                    ".ico": "image/x-icon",
                };
                const contentType = mimeTypes[ext] || "application/octet-stream";
                return c.body(content, 200, { "Content-Type": contentType });
            }
        } catch (e) {
            // File not found, try index.html for SPA routing
            try {
                const indexPath = pathSync.join(WEB_DIR, "index.html");
                const content = fsSync.readFileSync(indexPath);
                return c.body(content, 200, { "Content-Type": "text/html" });
            } catch {
                return c.notFound();
            }
        }
        return c.notFound();
    });
}

// 大事
const port = Number(process.env.PORT || 8787);
serve({ fetch: app.fetch, port, hostname: "127.0.0.1" });
// touch