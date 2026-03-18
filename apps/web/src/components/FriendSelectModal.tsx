import React, { useEffect, useState } from "react";
import type { Friend } from "../types";

const API = (window as any).VAM_API_URL || "http://localhost:8787";

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
    borderRadius: 20,
    width: "480px",
    maxWidth: "92vw",
    maxHeight: "85vh",
    padding: "28px 32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
};

interface FriendSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userIds: string[]) => void;
    selectedUserIds: string[];
}

export function FriendSelectModal({ isOpen, onClose, onSave, selectedUserIds: initialSelected }: FriendSelectModalProps) {
    const [friends, setFriends] = useState<Friend[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>(initialSelected);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchInstanceFriends();
            setSelectedIds(initialSelected);
        }
    }, [isOpen, initialSelected]);

    const fetchInstanceFriends = async () => {
        setIsLoading(true);
        try {
            const r = await fetch(`${API}/instances/current/users`, { credentials: "include" });
            const j = await r.json();
            if (j.ok) {
                setFriends(j.users || []);
            }
        } catch (e) {
            console.error("Failed to fetch instance friends", e);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const toggleFriend = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-title)" }}>招待する人を選択</h3>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                        <button
                            onClick={() => setSelectedIds(friends.map(f => f.id))}
                            style={{ background: "none", border: "none", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                        >
                            全選択
                        </button>
                        <span style={{ color: "var(--border-main)", fontSize: "0.85rem", opacity: 0.5 }}>|</span>
                        <button
                            onClick={() => setSelectedIds([])}
                            style={{ background: "none", border: "none", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                        >
                            解除
                        </button>
                        <button 
                            onClick={onClose} 
                            style={{ background: "none", border: "none", fontSize: "28px", lineHeight: "1", cursor: "pointer", color: "var(--text-muted)", marginLeft: "8px", padding: 0 }}
                        >
                            &times;
                        </button>
                    </div>
                </div>

                {/* Warning Note */}
                <div style={{ 
                    fontSize: "0.75rem", 
                    color: "var(--text-muted)", 
                    background: "var(--bg-input)", 
                    padding: "12px 16px", 
                    borderRadius: "10px",
                    lineHeight: "1.5",
                    borderLeft: "4px solid #f59e0b"
                }}>
                    <span style={{ fontWeight: 700, color: "var(--text-main)", marginRight: "4px" }}>ⓘ 注意:</span>
                    ロケーションと招待のログから同一インスタンスのユーザーを取得していますが、VRChatのログはリアルタイムではなく、最新のログから取得できても実際のメンバーと差異が生じる可能性があります。
                </div>

                {/* List Body */}
                <div style={{ flex: 1, overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    {isLoading ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>読み込み中...</div>
                    ) : friends.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.9rem", lineHeight: "1.6" }}>
                            同じインスタンスにフレンドがいません。<br />
                            （Invite/Privateインスタンスの場合は取得できません）
                        </div>
                    ) : (
                        friends.map(f => {
                            const isSelected = selectedIds.includes(f.id);
                            return (
                                <div
                                    key={f.id}
                                    onClick={() => toggleFriend(f.id)}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        padding: "12px 16px",
                                        borderRadius: "12px",
                                        background: isSelected ? "rgba(34, 197, 94, 0.08)" : "transparent",
                                        border: "1px solid",
                                        borderColor: isSelected ? "rgba(34, 197, 94, 0.3)" : "transparent",
                                        cursor: "pointer",
                                        transition: "all 0.2s ease"
                                    }}
                                >
                                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                                        <div style={{ 
                                            fontSize: "0.95rem", 
                                            fontWeight: 700, 
                                            color: isSelected ? "var(--text-title)" : "var(--text-main)",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis"
                                        }}>
                                            {f.displayName}
                                        </div>
                                        {f.isFriend && (
                                            <span style={{ 
                                                fontSize: "0.6rem", 
                                                background: isSelected ? "rgba(34, 197, 94, 0.2)" : "var(--bg-input)", 
                                                color: isSelected ? "#22c55e" : "var(--text-muted)", 
                                                padding: "2px 6px", 
                                                borderRadius: "6px", 
                                                fontWeight: 800,
                                            }}>
                                                FRIEND
                                            </span>
                                        )}
                                    </div>

                                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                                        <div style={{ 
                                            fontSize: "0.8rem", 
                                            color: "var(--text-muted)", 
                                            maxWidth: "100px", 
                                            overflow: "hidden", 
                                            textOverflow: "ellipsis", 
                                            whiteSpace: "nowrap" 
                                        }}>
                                            {f.statusDescription || f.status}
                                        </div>
                                        
                                        <div style={{
                                            width: "20px",
                                            height: "20px",
                                            borderRadius: "50%",
                                            border: `2px solid ${isSelected ? "#22c55e" : "var(--text-muted)"}`,
                                            background: isSelected ? "#22c55e" : "transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            transition: "all 0.2s",
                                            opacity: isSelected ? 1 : 0.4
                                        }}>
                                            {isSelected && <span style={{ color: "#fff", fontSize: "12px", fontWeight: "bold" }}>✓</span>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", gap: "12px", marginTop: "4px" }}>
                    <button
                        style={{ 
                            flex: 1, padding: "12px", borderRadius: "10px", 
                            background: "var(--bg-input)", color: "var(--text-main)", 
                            border: "none", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" 
                        }}
                        onClick={onClose}
                    >
                        キャンセル
                    </button>
                    <button
                        style={{ 
                            flex: 2, padding: "12px", borderRadius: "10px", 
                            background: selectedIds.length > 0 ? "#22c55e" : "var(--bg-input)", 
                            color: selectedIds.length > 0 ? "#fff" : "var(--text-muted)", 
                            border: "none", fontWeight: 800, 
                            cursor: selectedIds.length > 0 ? "pointer" : "not-allowed", 
                            transition: "all 0.2s" 
                        }}
                        onClick={() => {
                            if (selectedIds.length > 0) {
                                onSave(selectedIds);
                                onClose();
                            }
                        }}
                    >
                        {selectedIds.length} 人を招待リストに追加
                    </button>
                </div>
            </div>
        </div>
    );
}
