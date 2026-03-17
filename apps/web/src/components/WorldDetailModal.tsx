import React from "react";
import type { World, CustomList } from "../types";

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1500,
    backdropFilter: "blur(8px)",
};

const modalStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 20,
    width: "1000px",
    maxWidth: "95vw",
    maxHeight: "85vh",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "row", // 横長レイアウト
    transition: "background-color 0.3s",
};

interface WorldDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    world: World | null;
    userTags: string[];
    customLists: CustomList[];
    onToggleList: (world: World, listId: string) => void;
    onOpenInstanceCreate: () => void;
    formatNumber: (n: number) => string;
    showToast: (message: string) => void;
}

export function WorldDetailModal({ isOpen, onClose, world, userTags, customLists, onToggleList, onOpenInstanceCreate, formatNumber, showToast }: WorldDetailModalProps) {

    if (!isOpen || !world) return null;

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return "-";
        try {
            return new Date(dateStr).toLocaleString("ja-JP", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return dateStr;
        }
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                
                {/* 左側: サムネイルエリア */}
                <div style={{ 
                    flex: "1.2", 
                    background: "#000", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    position: "relative",
                    minHeight: "400px"
                }}>
                    <img
                        src={world.thumbnail}
                        alt={world.name}
                        style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }}
                    />
                    <div style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "20px",
                        background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)",
                        color: "#fff"
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <h2 style={{ margin: 0, fontSize: "1.8rem", fontWeight: 800 }}>{world.name}</h2>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(world.name);
                                    showToast("ワールド名をコピーしました: " + world.name);
                                }}
                                style={{
                                    background: "rgba(255,255,255,0.2)",
                                    border: "1px solid rgba(255,255,255,0.3)",
                                    borderRadius: "8px",
                                    padding: "4px 8px",
                                    color: "#fff",
                                    fontSize: "0.75rem",
                                    cursor: "pointer",
                                    backdropFilter: "blur(4px)"
                                }}
                            >
                                📋 コピー
                            </button>
                        </div>
                        <p style={{ margin: "4px 0 0", opacity: 0.8, fontSize: "1rem" }}>by {world.authorName}</p>
                    </div>
                </div>

                {/* 右側: 情報エリア */}
                <div style={{ 
                    flex: "1", 
                    display: "flex", 
                    flexDirection: "column", 
                    padding: "32px", 
                    overflowY: "auto",
                    background: "var(--bg-card)"
                }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: -10 }}>
                        <button
                            onClick={onClose}
                            style={{
                                background: "var(--bg-input)",
                                border: "none",
                                borderRadius: "50%",
                                width: 36,
                                height: 36,
                                cursor: "pointer",
                                fontSize: "20px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "var(--text-muted)",
                                transition: "all 0.2s"
                            }}
                        >
                            &times;
                        </button>
                    </div>

                    {/* 説明文 */}
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Description</h3>
                        <p style={{ 
                            fontSize: "0.95rem", 
                            lineHeight: 1.6, 
                            color: "var(--text-main)", 
                            whiteSpace: "pre-wrap",
                            margin: 0,
                            padding: "16px",
                            background: "var(--bg-input)",
                            borderRadius: "12px",
                            border: "1px solid var(--border-main)"
                        }}>
                            {world.description || "説明はありません。"}
                        </p>
                    </div>

                    {/* 統計と日時 */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
                        <div style={{ padding: "12px", borderBottom: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>定員</div>
                            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-main)" }}>👥 {world.capacity} 人</div>
                        </div>
                        <div style={{ padding: "12px", borderBottom: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>訪問数</div>
                            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-main)" }}>👁 {formatNumber(world.visits)}</div>
                        </div>
                        <div style={{ padding: "12px", borderBottom: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>お気に入り</div>
                            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-main)" }}>⭐ {formatNumber(world.favorites)}</div>
                        </div>
                        <div style={{ padding: "12px", borderBottom: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>更新日</div>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)" }}>📅 {formatDate(world.updatedAt)}</div>
                        </div>
                        <div style={{ padding: "12px", borderBottom: "1px solid var(--border-main)" }}>
                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>公開日 (作成日)</div>
                            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text-main)" }}>🐣 {formatDate(world.createdAt)}</div>
                        </div>
                    </div>

                    {/* タグ */}
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>Tags</h3>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                            {userTags.map(t => (
                                <span key={t} className="user-tag" style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "0.8rem" }}>
                                    {t}
                                </span>
                            ))}
                            {world.tags.filter(t => t.startsWith("author_tag_")).map(t => (
                                <span key={t} className="world-tag" style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "0.8rem" }}>
                                    {t.replace("author_tag_", "")}
                                </span>
                            ))}
                            {world.tags.filter(t => !t.startsWith("author_tag_") && !t.startsWith("system_")).map(t => (
                                <span key={t} className="world-tag" style={{ background: "#f1f5f9", padding: "4px 10px", borderRadius: "8px", fontSize: "0.8rem" }}>
                                    {t}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* マイリスト管理 */}
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>My Lists</h3>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                {customLists.map(list => {
                                    const isInList = list.worlds.some(w => w.id === world.id);
                                    return (
                                        <label key={list.id} style={{ 
                                            display: "flex", 
                                            alignItems: "center", 
                                            gap: 8, 
                                            fontSize: "0.9rem", 
                                            cursor: "pointer",
                                            padding: "8px 12px",
                                            background: isInList ? "rgba(37, 99, 235, 0.1)" : "var(--bg-input)",
                                            borderRadius: "8px",
                                            border: `1px solid ${isInList ? "#bfdbfe" : "var(--border-main)"}`,
                                            color: isInList ? "#3b82f6" : "var(--text-muted)",
                                            transition: "all 0.2s"
                                        }}>
                                            <input 
                                                type="checkbox" 
                                                checked={isInList} 
                                                onChange={() => onToggleList(world, list.id)}
                                                style={{ cursor: "pointer" }}
                                            />
                                            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                {list.name}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>


                    {/* インスタンス作成ボタン */}
                    <div style={{ marginBottom: 24 }}>
                        <button
                            className="btn btn-success"
                            onClick={onOpenInstanceCreate}
                            style={{ width: "100%", padding: "16px", fontSize: "1.1rem", borderRadius: "12px", fontWeight: 700, boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}
                        >
                            🚀 インスタンスを建てる
                        </button>
                    </div>

                    {/* アクション */}
                    <div style={{ marginTop: "auto", display: "flex", gap: 12 }}>
                        <button
                            className="btn btn-secondary"
                            onClick={() => window.open(`https://vrchat.com/home/world/${world.id}`, "_blank")}
                            style={{ flex: 1, padding: "12px", fontSize: "0.9rem", borderRadius: "10px" }}
                        >
                            🌐 VRChat.comで開く
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
