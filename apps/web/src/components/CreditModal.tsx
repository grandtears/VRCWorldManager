import React from "react";

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1200,
};

const modalStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 8,
    padding: 24,
    width: 400,
    maxWidth: "90vw",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    textAlign: "center",
    transition: "background-color 0.3s",
};

interface CreditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function CreditModal({ isOpen, onClose }: CreditModalProps) {
    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h2 style={{ margin: "0 0 16px", color: "var(--text-title)", fontSize: "1.5rem" }}>
                    WorldNavi
                </h2>

                <p style={{ margin: "0 0 8px", fontSize: "1.1rem", color: "var(--text-main)" }}>
                    Version 0.1.0
                </p>

                <div style={{ margin: "24px 0", borderTop: "1px solid var(--border-main)", borderBottom: "1px solid var(--border-main)", padding: "16px 0" }}>
                    <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "var(--text-muted)" }}>
                        Circle: Last Memories
                    </p>
                    <p style={{ margin: "0 0 8px", fontWeight: "bold", color: "var(--text-muted)" }}>
                        Developer: Sonoty
                    </p>

                    <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 12 }}>
                        <a
                            href="https://x.com/SonotyHearts"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#1da1f2", textDecoration: "none", fontWeight: "bold" }}
                        >
                            X (Twitter)
                        </a>
                        <span style={{ color: "#ddd" }}>|</span>
                        <a
                            href="https://vrchat.com/home/user/usr_668cf573-47de-4418-85fe-95e319e2c413"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#e3305c", textDecoration: "none", fontWeight: "bold" }}
                        >
                            VRChat
                        </a>
                    </div>
                </div>

                <button
                    className="btn btn-secondary"
                    onClick={onClose}
                    style={{ width: 100 }}
                >
                    閉じる
                </button>
            </div>
        </div>
    );
}
