import React, { useState, useEffect } from "react";
import type { CustomList } from "../types";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1300,
};

const modalStyle: React.CSSProperties = {
  background: "var(--bg-card)",
  borderRadius: 12,
  padding: 24,
  width: 400,
  maxWidth: "90vw",
  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
  textAlign: "left",
  transition: "background-color 0.3s",
};

interface ListEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  onDelete?: () => void;
  editingList: CustomList | null;
}

export function ListEditModal({ isOpen, onClose, onSave, onDelete, editingList }: ListEditModalProps) {
  const [name, setName] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(editingList ? editingList.name : "");
      setIsConfirmingDelete(false);
    }
  }, [isOpen, editingList]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: "0 0 16px", color: "var(--text-title)", fontSize: "1.25rem", fontWeight: 700 }}>
          {editingList ? "リストを編集" : "新しいリストを作成"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: 600 }}>
              リスト名
            </label>
            <input
              autoFocus
              className="login-input"
              style={{ width: "100%", boxSizing: "border-box" }}
              placeholder="例: お気に入り, あとで行く..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              {editingList && onDelete && (
                !isConfirmingDelete ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => setIsConfirmingDelete(true)}
                    style={{ padding: "8px 16px" }}
                  >
                    🗑️ 削除
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={onDelete}
                    style={{ padding: "8px 16px", background: "#b91c1c" }}
                  >
                    本当に削除？
                  </button>
                )
              )}
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ padding: "8px 16px" }}
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!name.trim() || isConfirmingDelete}
                style={{ padding: "8px 24px", minWidth: 80 }}
              >
                {editingList ? "保存" : "作成"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
