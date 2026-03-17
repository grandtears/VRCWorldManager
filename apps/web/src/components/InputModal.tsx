import React, { useEffect, useRef, useState } from "react";

const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1100, // Higher than SettingsModal
};

const modalStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 8,
    padding: 16,
    width: 360,
    maxWidth: "90vw",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
};

interface InputModalProps {
    isOpen: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    initialValue?: string;
    onConfirm: (value: string) => void;
    onClose: () => void;
}

export function InputModal({
    isOpen,
    title,
    message,
    placeholder = "",
    initialValue = "",
    onConfirm,
    onClose,
}: InputModalProps) {
    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setValue(initialValue);
            // Focus input on open
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, initialValue]);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (value.trim()) {
            onConfirm(value.trim());
            setValue("");
        }
    };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ margin: "0 0 12px", fontSize: 18 }}>{title}</h3>
                {message && <p style={{ margin: "0 0 12px", color: "#555", fontSize: 14 }}>{message}</p>}

                <input
                    ref={inputRef}
                    className="login-input" // Reusing existing class for consistency, or we can inline style
                    style={{ width: "100%", marginBottom: 16, boxSizing: "border-box" }}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") handleSubmit();
                        if (e.key === "Escape") onClose();
                    }}
                />

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ height: 32 }}>
                        キャンセル
                    </button>
                    <button
                        className="login-button"
                        style={{ width: "auto", margin: 0, padding: "0 16px", height: 32 }}
                        onClick={handleSubmit}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
