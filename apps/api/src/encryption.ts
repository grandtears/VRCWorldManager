import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { logToFile } from "./logger.ts";

const ALGORITHM = "aes-256-gcm";
const SECRET_KEY_HEX = process.env.VAM_SECRET;

/**
 * 暗号化可能かどうか（鍵があるか、またはWindows環境か）
 */
export function isEncryptionAvailable() {
    if (SECRET_KEY_HEX && SECRET_KEY_HEX.length === 64) return true;
    return process.platform === "win32";
}

/**
 * Windows DPAPIを使用して暗号化する (fallback)
 * 形式: dpapi:base64
 */
function encryptDPAPI(text: string): string {
    try {
        // PowerShellを使用してマシン固有の暗号化を行う
        // 文字列内のシングルクォートをエスケープ
        const escaped = text.replace(/'/g, "''");
        const script = `Add-Type -AssemblyName 'System.Security'; [System.Convert]::ToBase64String([System.Security.Cryptography.ProtectedData]::Protect([System.Text.Encoding]::UTF8.GetBytes('${escaped}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))`;
        const result = execSync(`powershell -Command "${script}"`, { encoding: "utf8" }).trim();
        return `dpapi:${result}`;
    } catch (e) {
        logToFile(`[Encryption] DPAPI Encrypt failed: ${e}`);
        throw e;
    }
}

/**
 * Windows DPAPIを使用して復号する (fallback)
 */
function decryptDPAPI(encrypted: string): string {
    try {
        const base64 = encrypted.substring(6); // remove "dpapi:"
        const script = `Add-Type -AssemblyName 'System.Security'; [System.Text.Encoding]::UTF8.GetString([System.Security.Cryptography.ProtectedData]::Unprotect([System.Convert]::FromBase64String('${base64}'), $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser))`;
        const result = execSync(`powershell -Command "${script}"`, { encoding: "utf8" }).trim();
        return result;
    } catch (e) {
        logToFile(`[Encryption] DPAPI Decrypt failed: ${e}`);
        throw e;
    }
}

/**
 * 文字列を暗号化する
 * 形式: iv(hex):authTag(hex):encrypted(hex) または dpapi:base64
 */
export function encrypt(text: string): string {
    if (SECRET_KEY_HEX && SECRET_KEY_HEX.length === 64) {
        try {
            const key = Buffer.from(SECRET_KEY_HEX!, "hex");
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

            let encrypted = cipher.update(text, "utf8", "hex");
            encrypted += cipher.final("hex");

            const authTag = cipher.getAuthTag();

            return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
        } catch (e) {
            logToFile(`[Encryption] AES Encrypt failed: ${e}`);
            throw e;
        }
    } else if (process.platform === "win32") {
        return encryptDPAPI(text);
    }
    
    throw new Error("Encryption is not available (No key and not on Windows)");
}

/**
 * 文字列を復号する
 */
export function decrypt(text: string): string {
    if (text.startsWith("dpapi:")) {
        if (process.platform !== "win32") {
            throw new Error("DPAPI encryption is only supported on Windows");
        }
        return decryptDPAPI(text);
    }

    if (SECRET_KEY_HEX && SECRET_KEY_HEX.length === 64) {
        try {
            const parts = text.split(":");
            if (parts.length !== 3) {
                throw new Error("Invalid encrypted format");
            }

            const [ivHex, authTagHex, encryptedHex] = parts;

            const key = Buffer.from(SECRET_KEY_HEX!, "hex");
            const iv = Buffer.from(ivHex, "hex");
            const authTag = Buffer.from(authTagHex, "hex");

            const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
            decipher.setAuthTag(authTag);

            let decrypted = decipher.update(encryptedHex, "hex", "utf8");
            decrypted += decipher.final("utf8");

            return decrypted;
        } catch (e) {
            logToFile(`[Encryption] AES Decrypt failed: ${e}`);
            throw e;
        }
    }

    throw new Error("Encryption key is not available for this format");
}
