import React, { useState, useEffect } from "react";
import { getVrcLogPath, saveVrcLogPath, getTheme, saveTheme, exportStorage, importStorage } from "../storage";

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 3000,
    backdropFilter: "blur(8px)",
};

const modalStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 24,
    width: "480px",
    maxWidth: "95vw",
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    transition: "background-color 0.3s",
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    showToast: (msg: string) => void;
    onThemeChange: (theme: "light" | "dark") => void;
    onImportSuccess: () => void;
}

export function SettingsModal({ isOpen, onClose, showToast, onThemeChange, onImportSuccess }: SettingsModalProps) {
    const [logPath, setLogPath] = useState("");
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setLogPath(getVrcLogPath());
            setIsDarkMode(getTheme() === "dark");
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSave = () => {
        saveVrcLogPath(logPath.trim());
        const newTheme = isDarkMode ? "dark" : "light";
        saveTheme(newTheme);
        onThemeChange(newTheme);
        showToast("設定を保存しました");
        onClose();
    };

    const handleExport = () => {
        const json = exportStorage();
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vrc_world_manager_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast("データをエクスポートしました");
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const content = event.target?.result as string;
            const success = await importStorage(content);
            if (success) {
                showToast("データをインポートしました");
                onImportSuccess();
                onClose();
            } else {
                showToast("インポートに失敗しました。ファイル形式を確認してください。");
            }
        };
        reader.readAsText(file);
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ margin: "0 0 24px 0", fontSize: "1.5rem", fontWeight: 800, color: "var(--text-title)" }}>Settings</h2>
                
                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 700, color: "#64748b", marginBottom: 8 }}>
                        VRChat ログ保存場所 (任意)
                    </label>
                    <input 
                        type="text"
                        value={logPath}
                        onChange={(e) => setLogPath(e.target.value)}
                        placeholder="例: C:\Users\YourName\AppData\LocalLow\VRChat\VRChat"
                        style={{ 
                            width: "100%", 
                            padding: "12px 16px", 
                            borderRadius: "12px", 
                            border: "1px solid #e2e8f0",
                            fontSize: "0.95rem",
                            outline: "none",
                            boxSizing: "border-box"
                        }}
                    />
                    <p style={{ marginTop: 8, fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.5 }}>
                        空欄の場合はデフォルトの場所（AppData\LocalLow\VRChat\VRChat）が使用されます。
                    </p>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", fontSize: "0.95rem", fontWeight: 700, color: "var(--text-title)" }}>
                        <input 
                            type="checkbox"
                            checked={isDarkMode}
                            onChange={(e) => setIsDarkMode(e.target.checked)}
                            style={{ width: "20px", height: "20px", cursor: "pointer" }}
                        />
                        ダークモードを有効にする
                    </label>
                </div>

                <div style={{ marginBottom: 32, padding: "16px", background: "var(--bg-input)", borderRadius: "16px", border: "1px solid var(--border-main)" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase" }}>
                        データ管理 (JSON)
                    </label>
                    <div style={{ display: "flex", gap: 12 }}>
                        <button 
                            onClick={handleExport}
                            style={{ 
                                flex: 1, 
                                padding: "10px", 
                                borderRadius: "8px", 
                                background: "var(--bg-card)", 
                                border: "1px solid var(--border-main)", 
                                color: "var(--text-main)",
                                fontWeight: 700,
                                fontSize: "0.85rem",
                                cursor: "pointer"
                            }}
                        >
                            📤 エクスポート
                        </button>
                        <label style={{ 
                            flex: 1, 
                            padding: "10px", 
                            borderRadius: "8px", 
                            background: "var(--bg-card)", 
                            border: "1px solid var(--border-main)", 
                            color: "var(--text-main)",
                            fontWeight: 700,
                            textAlign: "center",
                            fontSize: "0.85rem",
                            cursor: "pointer"
                        }}>
                            📥 インポート
                            <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
                        </label>
                    </div>
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <button 
                        onClick={onClose}
                        style={{ 
                            flex: 1, 
                            padding: "12px", 
                            borderRadius: "12px", 
                            background: "#f1f5f9", 
                            border: "none", 
                            fontWeight: 700, 
                            color: "#64748b",
                            cursor: "pointer"
                        }}
                    >
                        キャンセル
                    </button>
                    <button 
                        onClick={handleSave}
                        style={{ 
                            flex: 1, 
                            padding: "12px", 
                            borderRadius: "12px", 
                            background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)", 
                            border: "none", 
                            fontWeight: 700, 
                            color: "#fff",
                            cursor: "pointer"
                        }}
                    >
                        保存する
                    </button>
                </div>
            </div>
        </div>
    );
}
