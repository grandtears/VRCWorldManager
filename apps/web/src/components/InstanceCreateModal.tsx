import React, { useEffect } from "react";
import type { World, Group } from "../types";
import { FriendSelectModal } from "./FriendSelectModal";

const API = (window as any).VAM_API_URL || "http://localhost:8787";

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000, 
    backdropFilter: "blur(4px)",
};

const modalStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 20,
    width: "500px",
    maxWidth: "95vw",
    maxHeight: "90vh",
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    transition: "background-color 0.3s",
};

interface InstanceCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    world: World | null;
    userId: string;
    showToast: (message: string) => void;
}

export function InstanceCreateModal({ isOpen, onClose, world, userId, showToast }: InstanceCreateModalProps) {
    const [instanceType, setInstanceType] = React.useState("public");
    const [region, setRegion] = React.useState("jp");
    const [groups, setGroups] = React.useState<Group[]>([]);
    const [selectedGroupId, setSelectedGroupId] = React.useState("");
    const [groupAccessType, setGroupAccessType] = React.useState("members");
    const [isLoadingGroups, setIsLoadingGroups] = React.useState(false);
    const [isCreating, setIsCreating] = React.useState(false);
    const [shouldInviteSelf, setShouldInviteSelf] = React.useState(true);
    const [isFriendModalOpen, setIsFriendModalOpen] = React.useState(false);
    const [selectedFriendIds, setSelectedFriendIds] = React.useState<string[]>([]);

    useEffect(() => {
        if (isOpen && userId) {
            fetchGroups();
        }
    }, [isOpen, userId]);

    const fetchGroups = async () => {
        setIsLoadingGroups(true);
        try {
            const r = await fetch(`${API}/groups?userId=${userId}`, { credentials: "include" });
            const j = await r.json();
            if (j.ok) {
                setGroups(j.groups || []);
                if (j.groups?.length > 0) {
                    setSelectedGroupId(j.groups[0].groupId || j.groups[0].id);
                }
            }
        } catch (e) {
            console.error("Failed to fetch groups", e);
        } finally {
            setIsLoadingGroups(false);
        }
    };

    if (!isOpen || !world) return null;

    const launchInstance = async () => {
        setIsCreating(true);
        try {
            const params: any = {
                worldId: world.id,
                type: instanceType === "invite_plus" ? "private" : instanceType,
                region: region,
                capacity: world.capacity,
            };

            if (instanceType === "invite_plus") {
                params.canRequestInvite = true;
            }

            if (instanceType !== "public" && instanceType !== "group") {
                params.ownerId = userId;
            }

            if (instanceType === "group") {
                params.groupId = selectedGroupId;
                params.groupAccessType = groupAccessType;
            }

            const r = await fetch(`${API}/instances/create`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(params),
                credentials: "include"
            });
            const j = await r.json();

            if (j.ok && j.instance) {
                // 自分に招待を送る
                if (shouldInviteSelf) {
                    try {
                        const [wId, iId] = j.instance.id.split(':');
                        await fetch(`${API}/instances/invite-myself`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ worldId: wId, instanceId: iId }),
                            credentials: "include"
                        });
                    } catch (e) {
                        console.error("Failed to send invite to self", e);
                    }
                }

                // 一括招待
                if (selectedFriendIds.length > 0) {
                    try {
                        await fetch(`${API}/instances/invite`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userIds: selectedFriendIds, instanceId: j.instance.id }),
                            credentials: "include"
                        });
                    } catch (e) {
                        console.error("Failed to send batch invites", e);
                    }
                }

                showToast("インスタンスを作成しました。招待を確認してください。");
                onClose();
            } else {
                const errorMsg = j.body?.error?.message || j.error || "Unknown error";
                alert("インスタンスの作成に失敗しました: " + errorMsg);
            }
        } catch (e) {
            alert("通信エラーが発生しました");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-title)" }}>Instance Settings</h2>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                </div>

                <div style={{ marginBottom: 24 }}>
                    <p style={{ margin: "0 0 16px", fontSize: "0.95rem", color: "var(--text-main)" }}>
                        <strong style={{ color: "var(--text-title)" }}>{world.name}</strong> のインスタンスを作成します。
                    </p>

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                            Access Type (VRChat API: Get User Groups)
                        </label>
                        <select 
                            style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid var(--border-main)", fontSize: "1rem", background: "var(--bg-input)", color: "var(--text-main)" }}
                            value={instanceType}
                            onChange={(e) => setInstanceType(e.target.value)}
                        >
                            <option value="public">Public (誰でも参加可能)</option>
                            <option value="hidden">Friend+ (フレンドのフレンドまで)</option>
                            <option value="friends">Friends (フレンドのみ)</option>
                            <option value="invite_plus">Invite+ (招待リクエスト可能)</option>
                            <option value="private">Invite (招待のみ)</option>
                            <option value="group">Group (グループ)</option>
                        </select>
                    </div>

                    {instanceType === "group" && (
                        <div style={{ padding: "16px", background: "var(--bg-input)", borderRadius: "12px", border: "1px solid var(--border-main)", marginBottom: 16 }}>
                            <div style={{ marginBottom: 12 }}>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Select Group</label>
                                {isLoadingGroups ? (
                                    <div style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Loading groups...</div>
                                ) : (
                                    <select 
                                        style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--text-main)" }}
                                        value={selectedGroupId}
                                        onChange={(e) => setSelectedGroupId(e.target.value)}
                                    >
                                        {groups.map(g => (
                                            <option key={g.id} value={g.groupId || g.id}>{g.name}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                            <div>
                                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 6 }}>Group Access Type</label>
                                <select 
                                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid var(--border-main)", background: "var(--bg-card)", color: "var(--text-main)" }}
                                    value={groupAccessType}
                                    onChange={(e) => setGroupAccessType(e.target.value)}
                                >
                                    <option value="public">Public (誰でも参加可能)</option>
                                    <option value="plus">Plus (グループメンバーのフレンドまで)</option>
                                    <option value="members">Members (グループメンバーのみ)</option>
                                </select>
                            </div>
                        </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                            Region
                        </label>
                        <select 
                            style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid var(--border-main)", fontSize: "1rem", background: "var(--bg-input)", color: "var(--text-main)" }}
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                        >
                            <option value="use">US East (米国東部)</option>
                            <option value="us">US West (米国西部)</option>
                            <option value="eu">Europe (欧州)</option>
                            <option value="jp">Japan (日本)</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }} onClick={() => setShouldInviteSelf(!shouldInviteSelf)}>
                        <div style={{ 
                            width: 20, 
                            height: 20, 
                            borderRadius: 6, 
                            border: `2px solid ${shouldInviteSelf ? "#22c55e" : "#cbd5e1"}`,
                            background: shouldInviteSelf ? "#22c55e" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            transition: "all 0.2s"
                        }}>
                            {shouldInviteSelf && <span style={{ color: "#fff", fontSize: "14px" }}>✓</span>}
                        </div>
                        <span style={{ fontSize: "0.95rem", color: "var(--text-main)", fontWeight: 600 }}>自分にインバイト（招待）を送る</span>
                    </div>

                    <div style={{ marginBottom: 24, padding: "16px", background: "var(--bg-input)", borderRadius: "12px", border: "1px solid var(--border-main)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)" }}>一括招待</div>
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                                {selectedFriendIds.length > 0 ? `${selectedFriendIds.length}人を選択中` : "現在のインスタンスの人を招待"}
                            </div>
                        </div>
                        <button 
                            className="btn btn-secondary" 
                            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
                            onClick={() => setIsFriendModalOpen(true)}
                        >
                            {selectedFriendIds.length > 0 ? "変更する" : "人を選ぶ"}
                        </button>
                    </div>
                </div>

                <button
                    className="btn btn-success"
                    onClick={launchInstance}
                    disabled={isCreating || (instanceType === "group" && !selectedGroupId)}
                    style={{ 
                        width: "100%", 
                        padding: "16px", 
                        fontSize: "1.1rem", 
                        borderRadius: "12px", 
                        fontWeight: 700, 
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                        opacity: isCreating ? 0.7 : 1,
                        cursor: isCreating ? "not-allowed" : "pointer"
                    }}
                >
                    {isCreating ? "Creating..." : "🚀 インスタンスを作成"}
                </button>
            </div>

            <FriendSelectModal 
                isOpen={isFriendModalOpen} 
                onClose={() => setIsFriendModalOpen(false)} 
                onSave={(ids) => setSelectedFriendIds(ids)}
                selectedUserIds={selectedFriendIds}
            />
        </div>
    );
}
