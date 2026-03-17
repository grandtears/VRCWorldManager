import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { logToFile } from "./logger.ts";

interface LogPlayer {
    id: string;
    displayName: string;
}

interface LogHistoryEntry {
    worldId: string;
    instanceId: string;
    worldName: string;
    timestamp: string;
}

let lastLogPath: string | null = null;
let lastFileSize = 0;
let currentPlayers = new Map<string, LogPlayer>();
let currentWorldId: string | null = null;
let currentWorldName: string = "Unknown World";
let worldHistory: LogHistoryEntry[] = [];
let customLogDir: string | null = null;

export function setVrcLogPath(dir: string | null) {
    if (dir !== customLogDir) {
        logToFile(`[vrc-log] custom log directory set to: ${dir}`);
        customLogDir = dir;
        lastLogPath = null; // パスが変わったらリセットを促す
    }
}

function getLatestLogPath() {
    const logDir = customLogDir || path.join(os.homedir(), "AppData", "LocalLow", "VRChat", "VRChat");
    if (!fs.existsSync(logDir)) return null;

    const files = fs.readdirSync(logDir)
        .filter(f => f.startsWith("output_log_") && f.endsWith(".txt"))
        .map(f => ({ name: f, time: fs.statSync(path.join(logDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);

    return files.length > 0 ? path.join(logDir, files[0].name) : null;
}

export function updateLogData() {
    const logPath = getLatestLogPath();
    if (!logPath) return;

    // ログファイルが変わった場合はリセット
    if (logPath !== lastLogPath) {
        logToFile(`[vrc-log] log file changed: ${logPath}`);
        lastLogPath = logPath;
        lastFileSize = 0;
        currentPlayers.clear();
        currentWorldId = null;
    }

    try {
        const stats = fs.statSync(logPath);
        if (stats.size <= lastFileSize) return;

        const buffer = Buffer.alloc(stats.size - lastFileSize);
        const fd = fs.openSync(logPath, 'r');
        fs.readSync(fd, buffer, 0, buffer.length, lastFileSize);
        fs.closeSync(fd);

        const content = buffer.toString('utf8');
        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            // ワールド名取得: [Behaviour] Entering Room: World Name
            if (line.includes("[Behaviour] Entering Room:")) {
                const parts = line.split("[Behaviour] Entering Room:");
                if (parts.length > 1) {
                    currentWorldName = parts[1].trim();
                    logToFile(`[vrc-log] Detected world name: ${currentWorldName}`);
                    
                    // 履歴に追加（最新のIDと紐づけ）
                    if (currentWorldId) {
                        const [wId, iId] = currentWorldId.split(':');
                        const entry: LogHistoryEntry = {
                            worldId: wId,
                            instanceId: iId || "",
                            worldName: currentWorldName,
                            timestamp: new Date().toISOString()
                        };
                        
                        // 重複排除（直近と同じなら追加しない）
                        const lastEntry = worldHistory[0];
                        if (!lastEntry || lastEntry.worldId !== wId || lastEntry.instanceId !== iId) {
                            worldHistory.unshift(entry);
                            if (worldHistory.length > 10) worldHistory.pop();
                        }
                    }
                }
            }

            // ワールド参加: [Behaviour] Joining wrld_...
            if (line.includes("[Behaviour] Joining wrld_")) {
                const match = line.match(/Joining (wrld_[a-f0-9-]+:[^~\s]+)/);
                if (match) {
                    const fullId = match[1];
                    logToFile(`[vrc-log] Entering world: ${fullId}`);
                    currentWorldId = fullId;
                    currentPlayers.clear(); // Always clear when joining a new instance
                }
            }
            // プレイヤー参加: [Behaviour] OnPlayerJoined <Name> (usr_<id>)
            else if (line.includes("[Behaviour] OnPlayerJoined")) {
                const match = line.match(/OnPlayerJoined (.*) \((usr_[a-f0-9-]+)\)/);
                if (match) {
                    const displayName = match[1].trim();
                    const userId = match[2];
                    currentPlayers.set(userId, { id: userId, displayName });
                    logToFile(`[vrc-log] Player joined: ${displayName} (${userId})`);
                }
            }
            // プレイヤー退出: [Behaviour] OnPlayerLeft <Name> (usr_<id>)
            else if (line.includes("[Behaviour] OnPlayerLeft")) {
                const match = line.match(/OnPlayerLeft (.*) \((usr_[a-f0-9-]+)\)/);
                if (match) {
                    const userId = match[2];
                    currentPlayers.delete(userId);
                    logToFile(`[vrc-log] Player left: ${userId}`);
                }
            }
        }

        lastFileSize = stats.size;
    } catch (e) {
        logToFile(`[vrc-log] error reading log: ${e}`);
    }
}

export function getLogPlayers() {
    return Array.from(currentPlayers.values());
}

export function getCurrentLogWorldId() {
    return currentWorldId;
}

export function getCurrentLogWorldName() {
    return currentWorldName;
}

export function getLogHistory() {
    return worldHistory;
}
