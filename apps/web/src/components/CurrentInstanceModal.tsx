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
    borderRadius: 24,
    width: "480px",
    maxWidth: "95vw",
    maxHeight: "85vh",
    padding: "32px",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    transition: "background-color 0.3s",
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


    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "var(--text-title)" }}>Current Instance</h2>
                        <button 
                            onClick={(e) => { e.stopPropagation(); fetchDetails(); }} 
                            disabled={isLoading}
                            style={{ background: "var(--bg-input)", border: "none", borderRadius: "8px", padding: "4px 10px", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 700 }}
                        >
                            {isLoading ? "読み込み中..." : "🔄 更新"}
                        </button>
                    </div>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "24px", cursor: "pointer", color: "var(--text-muted)" }}>&times;</button>
                </div>

                <div style={{ flex: 1, overflowY: "auto", marginBottom: 24 }}>
                    {isLoading ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>読み込み中...</div>
                    ) : error ? (
                        <div style={{ textAlign: "center", padding: "40px", color: "#ef4444", fontWeight: 600 }}>{error}</div>
                    ) : details ? (
                        <div>
                            <div style={{ padding: "20px", background: "var(--bg-input)", borderRadius: "16px", marginBottom: 24, border: "1px solid var(--border-main)" }}>
                                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Instance ID</div>
                                <div style={{ fontSize: "0.9rem", color: "var(--text-main)", wordBreak: "break-all", fontFamily: "monospace", marginBottom: 16 }}>{details.id}</div>
                                
                            </div>

                            <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 800, color: "var(--text-title)" }}>Occupants ({details.userCount})</h3>
                                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>※VRChatログおよびAPIから取得しています</div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {details.users.map((u: any) => (
                                    <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderRadius: "12px", background: "var(--bg-card)", border: "1px solid var(--border-main)" }}>
                                        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-title)", display: "flex", alignItems: "center", gap: 8 }}>
                                            {u.displayName || "Unknown"}
                                            {u.isFriend && <span style={{ fontSize: "0.7rem", background: "#f0fdf4", color: "#166534", padding: "2px 6px", borderRadius: "4px" }}>Friend</span>}
                                        </div>
                                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{u.status || "offline"}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>

                <button 
                    className="btn btn-secondary" 
                    style={{ width: "100%", padding: "14px", borderRadius: "12px", fontWeight: 700 }}
                    onClick={onClose}
                >
                    閉じる
                </button>
            </div>
        </div>
    );
}
