import { useMemo, useState } from "react";

type TagCloudProps = {
  tagCounts: Record<string, number>;
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
};

export function TagCloud({ tagCounts, activeTag, onSelect }: TagCloudProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const tags = useMemo(() => {
    return Object.keys(tagCounts).sort();
  }, [tagCounts]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...Object.values(tagCounts));
  }, [tagCounts]);

  if (tags.length === 0) return null;

  function getFontSize(count: number) {
    const minSize = 0.85;
    const maxSize = 1.3;
    const ratio = count / maxCount;
    return `${(minSize + (maxSize - minSize) * ratio).toFixed(2)}rem`;
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        className="sidebar-title"
        style={{ cursor: "pointer", userSelect: "none" }}
        onClick={() => setIsExpanded(v => !v)}
      >
        <span>🏷️ タグで絞り込み</span>
        <span style={{ fontSize: "0.75rem" }}>{isExpanded ? "▼" : "▶"}</span>
      </div>

      {isExpanded && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "baseline", marginTop: 8 }}>
          <button
            onClick={() => onSelect(null)}
            style={{
              border: "none",
              background: activeTag === null ? "var(--bg-tab-active)" : "transparent",
              color: activeTag === null ? "#fff" : "var(--text-muted)",
              borderRadius: "4px",
              padding: "2px 6px",
              cursor: "pointer",
              fontSize: "0.85rem",
              fontWeight: activeTag === null ? "bold" : "normal",
              transition: "all 0.2s",
              lineHeight: 1.2,
            }}
          >
            すべて
          </button>

          {tags.map(tag => {
            const isActive = tag === activeTag;
            const count = tagCounts[tag];
            return (
              <button
                key={tag}
                onClick={() => onSelect(isActive ? null : tag)}
                title={`${count}件`}
                style={{
                  border: "none",
                  background: isActive ? "var(--bg-tab-active)" : "transparent",
                  color: isActive ? "#fff" : "var(--text-muted)",
                  borderRadius: "4px",
                  padding: "2px 6px",
                  cursor: "pointer",
                  fontSize: getFontSize(count),
                  fontWeight: isActive ? "bold" : "normal",
                  transition: "all 0.2s",
                  lineHeight: 1.2,
                }}
              >
                {tag}
                <span style={{ fontSize: "0.7em", opacity: 0.7, marginLeft: 3 }}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
