import React, { useEffect, useRef } from "react";

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1100,
};

const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 8,
    padding: 16,
    width: 360,
    maxWidth: "90vw",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

export function ConfirmModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    const confirmBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Focus confirm button on open
            setTimeout(() => confirmBtnRef.current?.focus(), 50);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onCancel();
            } else if (e.key === "Enter") {
                onConfirm();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onConfirm, onCancel]);

    if (!isOpen) return null;

    return (
        <div style={overlayStyle} onClick={onCancel}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>{title}</h3>
                <p style={{ margin: "0 0 16px", color: "#555", fontSize: 14 }}>{message}</p>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onCancel}
                        style={{ height: 32 }}
                    >
                        キャンセル
                    </button>
                    <button
                        ref={confirmBtnRef}
                        className="btn btn-danger btn-sm"
                        style={{ height: 32 }}
                        onClick={onConfirm}
                    >
                        削除
                    </button>
                </div>
            </div>
        </div>
    );
}
