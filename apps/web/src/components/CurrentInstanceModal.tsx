import React, { useEffect, useState } from "react";

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

interface CurrentInstanceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CurrentInstanceModal({ isOpen, onClose }: CurrentInstanceModalProps) {
    const [details, setDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDetails();
        }
    }, [isOpen]);

    const fetchDetails = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const r = await fetch(`${API}/instances/current/details`, { credentials: "include" });
            const j = await r.json();
            if (j.ok) {
                setDetails(j.instance);
            } else {
                setError(j.error === "NOT_IN_INSTANCE" ? "現在インスタンスに入っていません。" : "情報の取得に失敗しました。");
            }
        } catch (e) {
            setError("通信エラーが発生しました。");
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleOpenBrowser = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!details || !details.id) return;
        
        const instanceFullId = details.id as string;
        const [worldId, ...rest] = instanceFullId.split(":");
        const instanceId = rest.join(":");
        
        if (worldId && instanceId) {
            const url = `https://vrchat.com/home/launch?worldId=${worldId}&instanceId=${instanceId}`;
            window.open(url, "_blank");
        } else if (worldId) {
            const url = `https://vrchat.com/home/world/${worldId}`;
            window.open(url, "_blank");
        }
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                    <div style={{ flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-title)", lineHeight: 1.2 }}>
                            {details?.world?.name || "Current Instance"}
                        </h2>
                        {details?.world?.name && (
                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                                Current Instance
                            </div>
                        )}
                    </div>
                    <div style={{ display: "flex", gap: "12px", alignItems: "center", flexShrink: 0 }}>
                        <button
                            onClick={(e) => { e.stopPropagation(); fetchDetails(); }}
                            disabled={isLoading}
                            style={{ background: "none", border: "none", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer", padding: 0 }}
                        >
                            {isLoading ? "更新中..." : "🔄 更新"}
                        </button>
                        <span style={{ color: "var(--border-main)", fontSize: "0.85rem", opacity: 0.5 }}>|</span>
                        <button
                            onClick={handleOpenBrowser}
                            disabled={!details?.id}
                            style={{ background: "none", border: "none", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", cursor: details?.id ? "pointer" : "default", padding: 0, opacity: details?.id ? 1 : 0.5 }}
                        >
                            🌐 ブラウザ
                        </button>
                        <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "28px", lineHeight: "1", cursor: "pointer", color: "var(--text-muted)", marginLeft: "4px", padding: 0 }}>&times;</button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "8px" }}>
                    {isLoading && !details ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>読み込み中...</div>
                    ) : error ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#ef4444", fontWeight: 700 }}>{error}</div>
                    ) : details ? (
                        <>
                            {/* Instance ID */}
                            <div style={{ padding: "16px", background: "var(--bg-input)", borderRadius: "12px" }}>
                                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Instance ID</div>
                                <div style={{ fontSize: "0.85rem", color: "var(--text-main)", wordBreak: "break-all", fontFamily: "monospace", opacity: 0.8 }}>{details.id}</div>
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

                            {/* Occupants List */}
                            <div>
                                <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 800, color: "var(--text-title)", display: "flex", alignItems: "center", gap: "8px" }}>
                                    Occupants
                                    <span style={{ background: "var(--bg-input)", color: "var(--text-muted)", padding: "2px 8px", borderRadius: "12px", fontSize: "0.75rem" }}>
                                        {details.userCount}
                                    </span>
                                </h3>
                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {details.users && details.users.length > 0 ? (
                                        details.users.map((u: any) => (
                                            <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "12px", background: "transparent", border: "1px solid var(--border-main)", transition: "all 0.2s ease" }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden" }}>
                                                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-title)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                        {u.displayName || "Unknown"}
                                                    </div>
                                                    {u.isFriend && (
                                                        <span style={{ fontSize: "0.6rem", background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", padding: "2px 6px", borderRadius: "6px", fontWeight: 800 }}>
                                                            FRIEND
                                                        </span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {u.status || "offline"}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                                            ユーザーが見つかりません
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div style={{ display: "flex", marginTop: "4px" }}>
                    <button
                        style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "var(--bg-input)", color: "var(--text-main)", border: "none", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" }}
                        onClick={onClose}
                    >
                        閉じる
                    </button>
                </div>
            </div>
        </div>
    );
}
