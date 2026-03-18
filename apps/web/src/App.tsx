import { useEffect, useMemo, useState } from "react";
import "./App.css";
import "./index.css";
import type {
  World,
  FavoriteGroup,
  CustomList,
  State,
  TwoFAMethod,
  LogHistoryEntry,
} from "./types";
import { fetchSettings, getCustomLists, saveCustomLists, getWorldTags, saveWorldTags, getTheme, getVrcLogPath } from "./storage";
import { CreditModal } from "./components/CreditModal";
import { ListEditModal } from "./components/ListEditModal";
import { WorldDetailModal } from "./components/WorldDetailModal";
import { InstanceCreateModal } from "./components/InstanceCreateModal";
import { CurrentInstanceModal } from "./components/CurrentInstanceModal";
import { SettingsModal } from "./components/SettingsModal";
import { TagCloud } from "./components/TagCloud";

// Toast Notification System
interface Toast {
  id: string;
  message: string;
}

const API = (window as any).VAM_API_URL || "http://localhost:8787";

export default function App() {
  const [state, setState] = useState<State>("boot");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [methods, setMethods] = useState<TwoFAMethod[]>([]);
  const [method, setMethod] = useState<TwoFAMethod>("totp");
  const [code, setCode] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");

  const canPickEmail = useMemo(() => methods.includes("emailOtp"), [methods]);
  const canPickTotp = useMemo(() => methods.includes("totp"), [methods]);

  const [loadingProgress, setLoadingProgress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const [query, setQuery] = useState("");
  const [globalQuery, setGlobalQuery] = useState("");

  const [showCredits, setShowCredits] = useState(false);

  // ワールド関連
  const [activeTab, setActiveTab] = useState<string>("recent");
  const [recentWorlds, setRecentWorlds] = useState<World[]>([]);
  const [favoriteWorlds, setFavoriteWorlds] = useState<World[]>([]);
  const [favoriteGroups, setFavoriteGroups] = useState<FavoriteGroup[]>([]);
  const [searchWorlds, setSearchWorlds] = useState<World[]>([]);

  const [recentHasMore, setRecentHasMore] = useState(false);
  const [recentOffset, setRecentOffset] = useState(0);
  const [favHasMore, setFavHasMore] = useState(false);
  const [favOffset, setFavOffset] = useState(0);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchOffset, setSearchOffset] = useState(0);

  const [customLists, setCustomLists] = useState<CustomList[]>([]);
  const [selectedCustomListId, setSelectedCustomListId] = useState<string | null>(null);

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listToEdit, setListToEdit] = useState<CustomList | null>(null);

  const [worldTags, setWorldTags] = useState<Record<string, string[]>>({});
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newTagInputs, setNewTagInputs] = useState<Record<string, string>>({});

  const [selectedWorldForModal, setSelectedWorldForModal] = useState<World | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isInstanceModalOpen, setIsInstanceModalOpen] = useState(false);
  const [isCurrentInstanceModalOpen, setIsCurrentInstanceModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [currentWorldName, setCurrentWorldName] = useState<string | null>(null);
  const [logHistory, setLogHistory] = useState<LogHistoryEntry[]>([]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const pageSize = 100;

  const selectedCustomList = useMemo(() => 
    customLists.find(l => l.id === selectedCustomListId),
    [customLists, selectedCustomListId]
  );

  // 表示するワールド
  const currentWorlds =
    activeTab === "recent" ? recentWorlds :
    activeTab === "updated" ? [...favoriteWorlds].sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()) :
    activeTab === "search_all" ? searchWorlds :
    activeTab === "custom" ? (selectedCustomList?.worlds || []) :
    favoriteWorlds;

  // 検索フィルタ（ローカル用：最近・お気に入りタブで使用）
  const filteredWorlds = useMemo(() => {
    let list: World[];

    // タグ選択中はタブに関わらず全ワールドから横断検索
    if (selectedTag) {
      const allCustomWorlds = customLists.flatMap(l => l.worlds);
      const seen = new Set<string>();
      list = [...recentWorlds, ...favoriteWorlds, ...allCustomWorlds].filter(w => {
        if (seen.has(w.id)) return false;
        seen.add(w.id);
        return (worldTags[w.id] || []).includes(selectedTag);
      });
    } else {
      list = currentWorlds;
    }

    // 検索語フィルタ
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((w) =>
      w.name.toLowerCase().includes(q) ||
      w.authorName.toLowerCase().includes(q)
    );
  }, [currentWorlds, recentWorlds, favoriteWorlds, customLists, query, selectedTag, worldTags]);

  // タグクラウドのデータ集計
  useEffect(() => {
    if (state === "logged_in") {
      const storedTheme = getTheme();
      setTheme(storedTheme);
      fetchSettings(); // 初期設定をフェッチ
      fetchCurrentLocation();
      const timer = setInterval(fetchCurrentLocation, 30000);
      return () => clearInterval(timer);
    }
  }, [state]);

  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
    }
  }, [theme]);

  const handleImportSuccess = () => {
    setCustomLists(getCustomLists());
    setWorldTags(getWorldTags());
    setTheme(getTheme());
    showToast("データの再読み込みが完了しました");
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      // storage.ts の pushSettingsDebounced は debounce されているため、
      // ここでは即座に保存されるようにリトライ付きの fetch を直接呼ぶか、
      // あるいは cache をそのまま POST する。
      // すでに storage.ts で設定保存用の API を fetch しているので、
      // それを再利用する。
      const settings = {
        customLists: getCustomLists(),
        worldTags: getWorldTags(),
        vrcLogPath: getVrcLogPath(),
        theme: getTheme(),
      };
      const r = await fetch(`${API}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (r.ok) {
        showToast("変更を同期しました ✅");
      } else {
        showToast("同期に失敗しました ❌");
      }
    } catch (e) {
      showToast("通信エラーが発生しました");
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCurrentLocation = async () => {
    try {
      const r = await fetch(`${API}/instances/current/details`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) {
        setCurrentLocation(j.instance.id);
        setCurrentWorldName(j.instance.worldName || j.instance.name || null);
      } else {
        setCurrentLocation(null);
        setCurrentWorldName(null);
      }
    } catch (e) {
      console.error("Failed to fetch location", e);
    }
  };

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(worldTags).forEach(tags => {
      tags.forEach(t => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return counts;
  }, [worldTags]);

  // ログイン
  async function doLogin() {
    setError("");

    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });

      const j = await r.json().catch(() => null);

      if (!j?.ok) {
        const msg = j?.body?.error?.message
          || (typeof j?.body?.error === "string" ? j?.body?.error : "")
          || j?.error
          || JSON.stringify(j?.body?.error)
          || "ログインに失敗しました";
        setError(`ログイン失敗: ${msg}`);
        return;
      }

      if (j.state === "2fa_required") {
        const m = (Array.isArray(j.methods) ? j.methods : []) as TwoFAMethod[];
        setMethods(m);
        setMethod(m.includes("totp") ? "totp" : "emailOtp");
        setState("2fa_required");
        return;
      }

      setDisplayName(j.displayName || "");
      setUserId(j.userId || "");
      setState("logged_in");
    } catch {
      setError("APIに接続できません（localhost:8787）");
    }
  }

  // 2FA
  async function do2fa() {
    setError("");
    setLoadingProgress("認証中...");

    try {
      const r = await fetch(`${API}/auth/2fa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ method, code }),
      });

      const j = await r.json().catch(() => null);

      if (!j?.ok) {
        let backendMsg = "Unknown error";
        if (j?.body?.error?.message) {
          backendMsg = j.body.error.message;
        } else if (j?.body?.error) {
          backendMsg = typeof j.body.error === 'string' ? j.body.error : JSON.stringify(j.body.error);
        } else if (j?.error) {
          backendMsg = j.error;
        } else if (j?.body) {
          backendMsg = JSON.stringify(j.body);
        }
        setError(`2FA失敗: ${backendMsg}`);
        return;
      }

      setDisplayName(j.displayName || "");
      setUserId(j.userId || "");
      setState("logged_in");
    } catch (e) {
      setError("2FA送信に失敗しました: " + String(e));
    } finally {
      setLoadingProgress("");
    }
  }

  // 最近のワールド取得
  async function fetchRecentWorlds(reset = false) {
    if (isLoading && !reset) return;
    setError("");
    setIsLoading(true);

    try {
      let currentOffset = reset ? 0 : recentOffset;
      if (reset) {
        setRecentWorlds([]);
        setRecentOffset(0);
      }

      setLoadingProgress("ワールドを取得中...");

      const r = await fetch(
        `${API}/worlds/recent?n=${pageSize}&offset=${currentOffset}`,
        { credentials: "include" }
      );
      const j = await r.json().catch(() => null);

      if (!j?.ok) {
        setError("ワールド取得に失敗（未ログイン/セッション切れ）");
        return;
      }

      const newItems: World[] = j.worlds || [];

      if (reset) {
        setRecentWorlds(newItems);
      } else {
        setRecentWorlds((prev) => [...prev, ...newItems]);
      }

      setRecentOffset(currentOffset + newItems.length);
      setRecentHasMore(!!j.hasMore);
    } catch {
      setError("ワールド取得APIに接続できません");
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  }

  // アプリ全体のワールド検索
  async function fetchSearchWorlds(reset = false, searchQuery: string = globalQuery.trim()) {
    if (isLoading && !reset) return;
    setError("");
    setIsLoading(true);

    try {
      let currentOffset = reset ? 0 : searchOffset;
      if (reset) {
        setSearchWorlds([]);
        setSearchOffset(0);
      }

      setLoadingProgress("ワールドを検索中...");

      let url = `${API}/worlds/search?n=${pageSize}&offset=${currentOffset}`;
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => null);

      if (!j?.ok) {
        setError("ワールド検索に失敗");
        return;
      }

      const newItems: World[] = j.worlds || [];

      if (reset) {
        setSearchWorlds(newItems);
      } else {
        setSearchWorlds([...searchWorlds, ...newItems]);
        setSearchOffset(currentOffset + pageSize);
      }
    } catch {
      setError("検索に失敗しました");
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  }

  // ログ履歴の取得
  async function fetchLogHistory() {
    try {
      const r = await fetch(`${API}/instances/log-history`, { credentials: "include" });
      const j = await r.json();
      if (j.ok) {
        setLogHistory(j.history || []);
      }
    } catch (e) {
      console.error("Failed to fetch log history", e);
    }
  }

  // 自分への招待送信
  async function inviteMe(worldId: string, instanceId: string) {
    try {
      const r = await fetch(`${API}/instances/invite-myself`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ worldId, instanceId }),
        credentials: "include"
      });
      const j = await r.json();
      if (j.ok) {
        showToast("招待を送信しました");
      } else {
        showToast("招待の送信に失敗しました");
      }
    } catch (e) {
      showToast("エラーが発生しました");
    }
  }

  // お気に入りワールド取得
  async function fetchFavoriteWorlds(reset = false, groupTag = "") {
    if (isLoading && !reset) return;
    setError("");
    setIsLoading(true);

    try {
      let currentOffset = reset ? 0 : favOffset;
      if (reset) {
        setFavoriteWorlds([]);
        setFavOffset(0);
      }

      setLoadingProgress("お気に入りワールドを取得中...");

      let url = `${API}/worlds/favorites?n=${pageSize}&offset=${currentOffset}`;
      if (groupTag) {
        url += `&tag=${encodeURIComponent(groupTag)}`;
      }

      const r = await fetch(url, { credentials: "include" });
      const j = await r.json().catch(() => null);

      if (!j?.ok) {
        setError("お気に入りワールド取得に失敗");
        return;
      }

      const newItems: World[] = j.worlds || [];

      if (reset) {
        setFavoriteWorlds(newItems);
      } else {
        setFavoriteWorlds((prev) => [...prev, ...newItems]);
      }

      setFavOffset(currentOffset + newItems.length);
      setFavHasMore(!!j.hasMore);
    } catch {
      setError("お気に入りワールド取得APIに接続できません");
    } finally {
      setIsLoading(false);
      setLoadingProgress("");
    }
  }

  // お気に入りグループ取得
  async function fetchFavoriteGroups() {
    try {
      const r = await fetch(`${API}/worlds/favorite-groups`, {
        credentials: "include",
      });
      const j = await r.json().catch(() => null);

      if (j?.ok) {
        setFavoriteGroups(j.groups || []);
      }
    } catch {
      // グループ取得失敗は致命的ではない
    }
  }

  // ログアウト
  async function doLogout() {
    setError("");
    try {
      await fetch(`${API}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // APIが落ちててもOK
    } finally {
      setState("idle");
      setDisplayName("");
      setRecentWorlds([]);
      setFavoriteWorlds([]);
      setFavoriteGroups([]);
      setSearchWorlds([]);
      setRecentOffset(0);
      setFavOffset(0);
      setSearchOffset(0);
      setRecentHasMore(false);
      setFavHasMore(false);
      setSearchHasMore(false);
      setQuery("");
      setGlobalQuery("");
    }
  }

  // 初期状態の設定ロード
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/auth/me`, { credentials: "include" });
        const j = await r.json().catch(() => null);

        if (j?.ok) {
          setDisplayName(j.displayName || "");
          setUserId(j.userId || "");
          setState("logged_in");
        } else {
          setState("idle");
        }
      } catch {
        setState("idle");
      }
    })();

    // カスタムリストのロード
    setCustomLists(getCustomLists());
    setWorldTags(getWorldTags());
  }, []);

  // ログイン後のデータ取得
  useEffect(() => {
    if (state === "logged_in") {
      fetchRecentWorlds(true);
      fetchFavoriteGroups();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // タブ切替時にデータ取得
  useEffect(() => {
    if (state !== "logged_in") return;
    
    // 検索語をクリアする場合はここで実施してもよいが、利便性のために残す手もある。
    // 今回はタブ切替で検索語をクリアしない方針とする。

    if (activeTab === "recent") {
      if (recentWorlds.length === 0) fetchRecentWorlds(true);
    } else if (activeTab === "updated") {
      if (favoriteWorlds.length === 0) fetchFavoriteWorlds(true, "");
    } else if (activeTab === "favorites_all") {
      if (favoriteWorlds.length === 0) fetchFavoriteWorlds(true, "");
    } else if (activeTab === "search_all") {
      if (searchWorlds.length === 0 && globalQuery.trim() !== "") {
        fetchSearchWorlds(true, globalQuery.trim());
      }
    } else if (activeTab.startsWith("fav_")) {
      const groupName = activeTab.replace("fav_", "");
      fetchFavoriteWorlds(true, groupName);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // 設定ロード（将来用）
  useEffect(() => {
    fetchSettings().then((s) => {
      if (s.customLists) {
        setCustomLists(s.customLists);
      }
    });
  }, []);

  // カスタムリスト管理
  function handleCreateList() {
    setListToEdit(null);
    setIsListModalOpen(true);
  }

  function handleEditList(list: CustomList, e: React.MouseEvent) {
    e.stopPropagation();
    setListToEdit(list);
    setIsListModalOpen(true);
  }

  function handleSaveList(name: string) {
    let next: CustomList[];
    if (listToEdit) {
      // 名前変更
      next = customLists.map(l => l.id === listToEdit.id ? { ...l, name } : l);
    } else {
      // 新規作成
      const newList: CustomList = {
        id: "cl_" + Date.now(),
        name,
        worlds: [],
      };
      next = [...customLists, newList];
    }
    setCustomLists(next);
    saveCustomLists(next);
    setIsListModalOpen(false);
  }

  function handleDeleteListAction() {
    if (!listToEdit) return;
    const next = customLists.filter(l => l.id !== listToEdit.id);
    setCustomLists(next);
    saveCustomLists(next);
    if (selectedCustomListId === listToEdit.id) {
      setActiveTab("recent");
      setSelectedCustomListId(null);
    }
    setIsListModalOpen(false);
  }

  function addWorldToList(world: World, listId: string) {
    const next = customLists.map(l => {
      if (l.id === listId) {
        if (l.worlds.some(w => w.id === world.id)) return l;
        return { ...l, worlds: [...l.worlds, world] };
      }
      return l;
    });
    setCustomLists(next);
    saveCustomLists(next);
  }

  function removeWorldFromList(worldId: string, listId: string) {
    const next = customLists.map(l => {
      if (l.id === listId) {
        return { ...l, worlds: l.worlds.filter(w => w.id !== worldId) };
      }
      return l;
    });
    setCustomLists(next);
    saveCustomLists(next);
  }

  function toggleWorldList(world: World, listId: string) {
    const list = customLists.find(l => l.id === listId);
    if (!list) return;
    if (list.worlds.some(w => w.id === world.id)) {
      removeWorldFromList(world.id, listId);
    } else {
      addWorldToList(world, listId);
    }
  }

  // タグ操作
  function addTag(worldId: string, tag: string) {
    const t = tag.trim();
    if (!t) return;
    const current = worldTags[worldId] || [];
    if (current.includes(t)) return;
    if (current.length >= 10) {
      showToast("タグは最大10個までです");
      return;
    }
    const next = { ...worldTags, [worldId]: [...current, t] };
    setWorldTags(next);
    saveWorldTags(next);
    setNewTagInputs(prev => ({ ...prev, [worldId]: "" }));
  }

  function removeTag(worldId: string, tag: string) {
    const current = worldTags[worldId] || [];
    const next = { ...worldTags, [worldId]: current.filter(t => t !== tag) };
    if (next[worldId].length === 0) {
      delete next[worldId];
    }
    setWorldTags(next);
    saveWorldTags(next);
  }

  // 数値フォーマット
  function formatNumber(n: number): string {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return String(n);
  }

  return (
    <div>
      <SettingsModal 
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onThemeChange={setTheme}
        onImportSuccess={handleImportSuccess}
        showToast={showToast}
      />

      <CreditModal
        isOpen={showCredits}
        onClose={() => setShowCredits(false)}
      />
      <header className="app-header">
        <h1 className="app-title">VRC World Manager</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {state === "logged_in" && currentLocation && (
            <div 
              style={{ padding: "8px 16px", background: "#f0fdf4", color: "#166534", borderRadius: "20px", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", gap: 6 }}
              onClick={() => setIsCurrentInstanceModalOpen(true)}
              title={currentLocation}
            >
              📍 Location: {currentWorldName || currentLocation || "World"}
            </div>
          )}
          {state === "logged_in" && (
            <div style={{ position: "relative" }}>
              <input
                className="search-input"
                style={{ padding: "6px 12px", width: "240px", fontSize: "0.9rem", borderRadius: "20px", border: "1px solid #cbd5e1" }}
                placeholder="🔍 検索..."
                value={globalQuery}
                onChange={(e) => setGlobalQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && globalQuery.trim() !== "") {
                    setActiveTab("search_all");
                    fetchSearchWorlds(true, globalQuery.trim());
                  }
                }}
              />
            </div>
          )}
          {state === "logged_in" && (
            <>
              <button
                onClick={doLogout}
                className="btn btn-danger btn-sm"
              >
                🚪 ログアウト
              </button>
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="btn btn-secondary btn-sm"
              >
                ⚙️ 設定
              </button>
            </>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => setShowCredits(true)}>ⓘ クレジット</button>
        </div>
      </header>

      {error && state !== "idle" && state !== "2fa_required" && (
        <div
          style={{
            padding: 12,
            marginBottom: 12,
            border: "1px solid #f99",
            background: "#fee",
          }}
        >
          {error}
        </div>
      )}

      {state === "boot" && <div style={{ opacity: 0.7 }}>起動中…</div>}

      {state === "idle" && (
        <div className="login-container">
          <div className="login-card">
            <h1 style={{ margin: "0 0 10px", color: "#555", fontSize: "1.2rem" }}>VRC World Manager</h1>
            <div className="login-title">ログイン</div>

            {error && (
              <div style={{
                color: "#d32f2f",
                backgroundColor: "#ffebee",
                padding: "8px",
                borderRadius: "4px",
                marginBottom: "8px",
                fontSize: "0.9rem",
                textAlign: "left"
              }}>
                {error}
              </div>
            )}

            <input
              className="login-input"
              placeholder="VRChat Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="login-input"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doLogin();
              }}
            />
            <button className="login-button" onClick={doLogin}>
              ログイン
            </button>

            <div className="security-note">
              🔒 認証情報はVRChatのAPI認証にのみ使用され、外部サーバーには送信されません。
            </div>
          </div>
        </div>
      )}

      {state === "2fa_required" && (
        <div className="login-container">
          <div className="login-card">
            <h2 className="login-title">2段階認証</h2>
            <div style={{ color: "#555", marginBottom: 16 }}>
              認証コードを入力してください。
            </div>

            {error && (
              <div style={{
                color: "#d32f2f",
                backgroundColor: "#ffebee",
                padding: "8px",
                borderRadius: "4px",
                marginBottom: "8px",
                fontSize: "0.9rem",
                textAlign: "left"
              }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontWeight: 600, color: "#666" }}>方式:</span>
              <select
                className="modern-select"
                style={{ flex: 1, padding: "10px" }}
                value={method}
                onChange={(e) => setMethod(e.target.value as TwoFAMethod)}
              >
                <option value="totp" disabled={!canPickTotp}>
                  Authenticator (TOTP)
                </option>
                <option value="emailOtp" disabled={!canPickEmail}>
                  Email OTP
                </option>
              </select>
            </div>

            <input
              className="login-input"
              placeholder="6桁コード"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") do2fa();
              }}
            />

            <button
              className="login-button"
              style={{ marginTop: 16 }}
              onClick={do2fa}
              disabled={loadingProgress !== ""}
            >
              {loadingProgress ? "送信中..." : "送信"}
            </button>
          </div>
        </div>
      )}

      {state === "logged_in" && (
        <div style={{ padding: "0 24px 24px", maxWidth: 1440, margin: "0 auto", position: "relative" }}>
          
          
          {/* 上段の分類タブ（VRChat上のワールド分類） */}
          <div className="top-category-tabs">
            <button
              className={`category-tab ${activeTab === "recent" ? "active" : ""}`}
              onClick={() => setActiveTab("recent")}
            >
              🕒 最近訪問 (API)
            </button>
            <button
              className={`category-tab ${activeTab === "updated" ? "active" : ""}`}
              onClick={() => setActiveTab("updated")}
            >
              🔄 最近更新されたワールド
            </button>
            <button
              className={`category-tab ${activeTab === "favorites_all" ? "active" : ""}`}
              onClick={() => setActiveTab("favorites_all")}
            >
              ⭐ すべてのお気に入り
            </button>
            <button
              className={`category-tab ${activeTab === "log_history" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("log_history");
                fetchLogHistory();
              }}
            >
              🕒 訪問ログ (直近10件)
            </button>
            {activeTab === "search_all" && (
              <button
                className="category-tab active"
                onClick={() => {}}
                style={{ cursor: "default" }}
              >
                🔍 検索結果
              </button>
            )}
            <div className="tab-divider"></div>
            {favoriteGroups.map(g => {
              const tabId = "fav_" + g.name;
              return (
                <button
                  key={g.id}
                  className={`category-tab ${activeTab === tabId ? "active" : ""}`}
                  onClick={() => setActiveTab(tabId)}
                >
                  📁 {g.displayName}
                </button>
              );
            })}
          </div>

          <div className="main-layout" style={{ padding: 0 }}>
            <aside className="app-sidebar">
              <div className="sidebar-title">
                <span>📂 カスタムリスト</span>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: "2px 8px", fontSize: "0.8rem" }}
                  onClick={handleCreateList}
                >
                  ＋ 追加
                </button>
              </div>
              <div className="custom-list-container">
                {customLists.length === 0 && (
                  <div style={{ fontSize: "0.85rem", color: "#888", textAlign: "center", padding: "10px 0" }}>
                    リストがありません
                  </div>
                )}
                {customLists.map(l => (
                  <div
                    key={l.id}
                    className={`custom-list-item ${activeTab === "custom" && selectedCustomListId === l.id ? "active" : ""}`}
                    onClick={() => {
                      setSelectedCustomListId(l.id);
                      setActiveTab("custom");
                    }}
                  >
                    <span className="custom-list-name">{l.name}</span>
                    <span className="custom-list-count">{l.worlds.length}</span>
                    <button
                      className="custom-list-edit-btn"
                      onClick={(e) => handleEditList(l, e)}
                      title="リストを編集"
                    >
                      ✏️
                    </button>
                  </div>
                ))}
              </div>

              {/* タグクラウド */}
              {Object.keys(tagCounts).length > 0 && (
                <div className="sidebar-section" style={{ marginTop: 20 }}>
                  <TagCloud
                    tagCounts={tagCounts}
                    activeTag={selectedTag}
                    onSelect={setSelectedTag}
                  />
                </div>
              )}
            </aside>

            {/* メインコンテンツ */}
            <main style={{ flex: 1, minWidth: 0 }}>
              {/* ログイン情報 */}
              <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  Logged in as <b>{displayName || "(unknown)"}</b>
                  {isLoading && (
                    <span style={{ marginLeft: 12, fontSize: "0.9rem", color: "#2563eb", fontWeight: "bold" }}>
                      🔄 {loadingProgress}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "0.9rem", color: "#666", display: "flex", alignItems: "center", gap: 12 }}>
                  {activeTab === "log_history" ? `訪問したことのあるワールドの履歴` : (
                    <>
                      表示件数: {currentWorlds.length}件 
                      {activeTab !== "recent" && activeTab !== "search_all" && activeTab !== "custom" && " (最大800件まで「もっと読む」で表示可能)"}
                      {activeTab === "updated" && " ※読み込み済みの星付きワールド内でソートしています"}
                      {activeTab === "custom" && ` ※カスタムリスト「${selectedCustomList?.name}」の内容を表示中`}
                    </>
                  )}
                  <button 
                    className="btn btn-success btn-sm" 
                    onClick={handleSync}
                    disabled={isSyncing}
                    style={{ padding: "6px 12px", borderRadius: "8px", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {isSyncing ? "同期中..." : "💾 変更を保存"}
                  </button>
                </div>
              </div>

              {activeTab === "log_history" && !selectedTag ? (
                <div style={{ padding: "0 0 20px" }}>
                  <h2 style={{ marginBottom: 20, fontSize: "1.25rem", display: "flex", alignItems: "center", gap: 10 }}>🕒 訪問ログ (直近10件) <button className="btn btn-secondary btn-sm" onClick={fetchLogHistory}>🔄 更新</button></h2>
                  {logHistory.length === 0 ? (
                    <div style={{ color: "#888", textAlign: "center", padding: 40, background: "#f8fafc", borderRadius: "16px" }}>ログが見つかりません。VRChatを起動してワールドを移動してください。</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {logHistory.map((h, i) => (
                        <div key={i} className="history-item" style={{ background: "#fff", padding: "16px", borderRadius: "16px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#1e293b", marginBottom: 4 }}>{h.worldName}</div>
                            <div style={{ fontSize: "0.85rem", color: "#64748b", fontFamily: "monospace", opacity: 0.8 }}>{h.worldId}:{h.instanceId}</div>
                            <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: 4 }}>{new Date(h.timestamp).toLocaleString()}</div>
                          </div>
                          <button 
                            className="btn btn-primary"
                            onClick={() => inviteMe(h.worldId, h.instanceId)}
                            style={{ padding: "8px 16px", borderRadius: "10px", fontWeight: 700, whiteSpace: "nowrap" }}
                          >
                            📩 Invite Me
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* 検索バー（ローカルフィルタ） */}
                  {(selectedTag || (activeTab !== "search_all" && activeTab !== "custom")) && (
                    <div style={{ marginBottom: 16 }}>
                      <input
                        className="search-input"
                        placeholder="リスト内をワールド名・作者名で絞り込み"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                  )}

              {/* ワールドグリッド */}
              <div className="world-grid">
                {isLoading && currentWorlds.length === 0 && Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="world-card" style={{ opacity: 0.7 }}>
                    <div className="world-thumb-container" style={{ background: "#eee", animation: "pulse 1.5s infinite" }}></div>
                    <div className="card-content" style={{ gap: 8 }}>
                      <div style={{ height: 24, background: "#eee", borderRadius: 4, width: "80%", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: 16, background: "#eee", borderRadius: 4, width: "50%", animation: "pulse 1.5s infinite" }} />
                      <div style={{ height: 16, background: "#eee", borderRadius: 4, width: "40%", animation: "pulse 1.5s infinite" }} />
                    </div>
                  </div>
                ))}
                {filteredWorlds.map((w) => (
                  <div key={w.id} className="world-card" onClick={() => {
                        setSelectedWorldForModal(w);
                        setIsDetailModalOpen(true);
                      }}>
                    <div className="world-thumb-container">
                      <img
                        src={w.thumbnail}
                        className="world-thumb"
                        loading="lazy"
                        alt={w.name}
                      />
                      <div style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        zIndex: 5
                      }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(w.name);
                            showToast("ワールド名をコピーしました: " + w.name);
                          }}
                          className="copy-badge"
                          title="名前をコピー"
                        >
                          📋
                        </button>
                      </div>

                      {/* プラットフォームインジケーター */}
                      <div style={{
                        position: "absolute",
                        top: 8,
                        left: 8,
                        display: "flex",
                        gap: 4,
                        zIndex: 5
                      }}>
                        {w.platforms?.includes("standalonewindows") && (
                          <span style={{ background: "#2563eb", color: "#fff", fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>PC</span>
                        )}
                        {w.platforms?.includes("android") && (
                          <span style={{ background: "#10b981", color: "#fff", fontSize: "0.65rem", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold" }}>Quest</span>
                        )}
                      </div>
                    </div>

                    <div className="card-content">
                      <div className="world-name">{w.name}</div>

                      <div className="card-meta">
                        <div>✍️ {w.authorName || "-"}</div>
                        <div>👥 定員: {w.capacity}</div>
                      </div>

                      <div className="world-stats">
                        <span className="stat-badge" title="訪問数">
                          👁 {formatNumber(w.visits)}
                        </span>
                        <span className="stat-badge" title="お気に入り数">
                          ⭐ {formatNumber(w.favorites)}
                        </span>
                      </div>

                      <div className="card-meta" style={{ marginTop: 4 }}>
                        <div>更新: {w.updatedAt ? new Date(w.updatedAt).toLocaleDateString() : "-"}</div>
                      </div>

                      {/* タグ表示 */}
                      {w.tags && w.tags.length > 0 && (
                        <div className="tags-container">
                          {w.tags
                            .filter(t => t.startsWith("author_tag_"))
                            .map(t => {
                              const displayName = t.replace("author_tag_", "");
                              return (
                                <span key={t} className="world-tag" title={t}>
                                  {displayName}
                                </span>
                              );
                            })}
                        </div>
                      )}

                      <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        {activeTab === "custom" && selectedCustomListId ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); removeWorldFromList(w.id, selectedCustomListId); }}
                            className="btn btn-danger btn-sm"
                            style={{ width: "100%", justifyContent: "center" }}
                          >
                            🗑️ リストから削除
                          </button>
                        ) : (
                          customLists.length > 0 && (
                            <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                              <select
                                className="modern-select"
                                style={{ flex: 1, fontSize: "0.8rem", padding: "4px" }}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    toggleWorldList(w, e.target.value);
                                    e.target.value = "";
                                  }
                                }}
                              >
                                <option value="">➕ リストに追加/削除...</option>
                                {customLists.map(l => {
                                  const isInList = l.worlds.some(item => item.id === w.id);
                                  return (
                                    <option key={l.id} value={l.id}>
                                      {isInList ? "✓ " : ""} {l.name}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          )
                        )}

                        {/* ユーザーカスタムタグ */}
                        <div className="user-tags-section" onClick={(e) => e.stopPropagation()}>
                          <div className="user-tags-list">
                            {(worldTags[w.id] || []).map(t => (
                              <span key={t} className="user-tag">
                                {t}
                                <button className="remove-tag-btn" onClick={(e) => { e.stopPropagation(); removeTag(w.id, t); }}>×</button>
                              </span>
                            ))}
                          </div>
                          <div className="tag-input-container">
                            <input
                              type="text"
                              className="tag-input"
                              placeholder="タグ追加 (Enter)"
                              value={newTagInputs[w.id] || ""}
                              onChange={(e) => setNewTagInputs(prev => ({ ...prev, [w.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  addTag(w.id, (e.target as HTMLInputElement).value);
                                }
                              }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(`https://vrchat.com/home/world/${w.id}`, "_blank", "noopener,noreferrer"); }}
                          className="btn btn-primary btn-sm"
                          style={{ width: "100%", justifyContent: "center" }}
                        >
                          🔗 VRChatで開く
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>


              {/* 空の場合 */}
              {!isLoading && filteredWorlds.length === 0 && currentWorlds.length > 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                  検索条件に一致するワールドがありません
                </div>
              )}
              {!isLoading && currentWorlds.length === 0 && (
                <div style={{ textAlign: "center", padding: 40, color: "#888" }}>
                  {activeTab === "recent" ? "最近訪問したワールドがありません" : "お気に入りワールドがありません"}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )}

      <ListEditModal
        isOpen={isListModalOpen}
        onClose={() => setIsListModalOpen(false)}
        onSave={handleSaveList}
        onDelete={handleDeleteListAction}
        editingList={listToEdit}
      />
      <WorldDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        world={selectedWorldForModal}
        userTags={selectedWorldForModal ? worldTags[selectedWorldForModal.id] || [] : []}
        customLists={customLists}
        onToggleList={toggleWorldList}
        onOpenInstanceCreate={() => setIsInstanceModalOpen(true)}
        formatNumber={formatNumber}
        showToast={showToast}
      />

      <InstanceCreateModal
        isOpen={isInstanceModalOpen}
        onClose={() => setIsInstanceModalOpen(false)}
        world={selectedWorldForModal}
        userId={userId}
        showToast={showToast}
      />

      <CurrentInstanceModal
        isOpen={isCurrentInstanceModalOpen}
        onClose={() => setIsCurrentInstanceModalOpen(false)}
      />

      {/* トースト表示 */}
      <div style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 9999,
        pointerEvents: "none"
      }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: "rgba(0, 0, 0, 0.8)",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: "50px",
            fontSize: "0.9rem",
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            animation: "fadeInUp 0.3s ease-out, fadeOutDown 0.3s ease-in 2.7s forwards",
            pointerEvents: "auto",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
