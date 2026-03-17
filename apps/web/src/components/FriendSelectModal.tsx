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
    borderRadius: 24,
    width: "450px",
    maxWidth: "90vw",
    maxHeight: "80vh",
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    transition: "background-color 0.3s",
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
    }, [isOpen]);

    const fetchInstanceFriends = async () => {
        setIsLoading(false);
        try {
            setIsLoading(true);
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: "var(--text-title)" }}>招待する人を選択</h3>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button 
                            onClick={() => setSelectedIds(friends.map(f => f.id))}
                            style={{ background: "var(--bg-input)", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}
                        >
                            全選択
                        </button>
                        <button 
                            onClick={() => setSelectedIds([])}
                            style={{ background: "var(--bg-input)", border: "none", borderRadius: "6px", padding: "4px 8px", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", cursor: "pointer" }}
                        >
                            解除
                        </button>
                        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--text-muted)", marginLeft: 4 }}>&times;</button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto", marginBottom: 24, paddingRight: 4 }}>
                    {isLoading ? (
                        <div style={{ textAlign: "center", padding: 20, color: "#64748b" }}>読み込み中...</div>
                    ) : friends.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 20, color: "#64748b", fontSize: "0.9rem" }}>
                            同じインスタンスにフレンドがいません。<br/>
                            （Invite/Privateインスタンスの場合は取得できません）
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {friends.map(f => (
                                <div 
                                    key={f.id} 
                                    onClick={() => toggleFriend(f.id)}
                                    style={{ 
                                        display: "flex", 
                                        alignItems: "center", 
                                        justifyContent: "space-between",
                                        padding: "10px 16px", 
                                        borderRadius: "12px",
                                        background: selectedIds.includes(f.id) ? "rgba(34, 197, 94, 0.1)" : "var(--bg-input)",
                                        border: `2px solid ${selectedIds.includes(f.id) ? "#22c55e" : "transparent"}`,
                                        cursor: "pointer",
                                        transition: "all 0.2s"
                                    }}
                                >
                                    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-title)" }}>{f.displayName}</div>
                                        {f.isFriend && <span style={{ fontSize: "0.65rem", background: "#f0fdf4", color: "#166534", padding: "1px 6px", borderRadius: "4px" }}>Friend</span>}
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{f.statusDescription || f.status}</div>
                                        <div style={{ 
                                            width: 18, 
                                            height: 18, 
                                            borderRadius: 4, 
                                            border: "2px solid #cbd5e1",
                                            background: selectedIds.includes(f.id) ? "#22c55e" : "transparent",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center"
                                        }}>
                                            {selectedIds.includes(f.id) && <span style={{ color: "#fff", fontSize: "12px" }}>✓</span>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ display: "flex", gap: 12 }}>
                    <button 
                        className="btn btn-secondary" 
                        style={{ flex: 1, padding: "12px" }} 
                        onClick={onClose}
                    >
                        キャンセル
                    </button>
                    <button 
                        className="btn btn-success" 
                        style={{ flex: 2, padding: "12px", fontWeight: 700 }}
                        onClick={() => {
                            onSave(selectedIds);
                            onClose();
                        }}
                    >
                        {selectedIds.length}人を招待リストに追加
                    </button>
                </div>
            </div>
        </div>
    );
}
