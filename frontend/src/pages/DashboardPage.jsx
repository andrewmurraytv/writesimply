import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, LogOut, FileText, Search, LayoutGrid, Columns3 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = ["all", "idea", "draft", "ready", "published"];
const BOARD_STATUSES = ["idea", "draft", "ready", "published"];

const statusStyles = {
  idea: "status-idea",
  draft: "status-draft",
  ready: "status-ready",
  published: "status-published",
};

export default function DashboardPage() {
  const { user, logout, apiFetch } = useAuth();
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [activeStatus, setActiveStatus] = useState("all");
  const [activeTag, setActiveTag] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingArticles, setLoadingArticles] = useState(true);
  const [view, setView] = useState("grid");
  const [dragOverStatus, setDragOverStatus] = useState(null);

  useEffect(() => {
    fetchArticles();
  }, []);

  const fetchArticles = async () => {
    try {
      const res = await apiFetch(`${API}/articles`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data);
      }
    } catch {
      toast.error("Failed to load articles");
    } finally {
      setLoadingArticles(false);
    }
  };

  const allTags = useMemo(() => {
    const tags = new Set();
    articles.forEach((a) => (a.tags || []).forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      if (activeStatus !== "all" && a.status !== activeStatus) return false;
      if (activeTag && !(a.tags || []).includes(activeTag)) return false;
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [articles, activeStatus, activeTag, searchQuery]);

  const kanbanColumns = useMemo(() => {
    return BOARD_STATUSES.map((s) => ({
      status: s,
      articles: filtered.filter((a) => a.status === s),
    }));
  }, [filtered]);

  const moveArticleStatus = async (article, toStatus) => {
    if (article.status === toStatus) return;
    const prevStatus = article.status;
    setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status: toStatus } : a)));
    try {
      const res = await apiFetch(`${API}/articles/${article.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: toStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Failed to move card");
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status: prevStatus } : a)));
    }
  };

  const createArticle = async () => {
    try {
      const res = await apiFetch(`${API}/articles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Untitled" }),
      });
      if (res.ok) {
        const article = await res.json();
        navigate(`/articles/${article.id}`);
      }
    } catch {
      toast.error("Failed to create article");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5]" data-testid="dashboard-page">
      {/* Header */}
      <header className="border-b border-[#E6E4DD] bg-[#FAF9F5] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#C96442]" strokeWidth={1.5} />
            <h1 className="text-lg font-bold text-[#1F1E1D] font-[Manrope] tracking-tight">
              WriteSimply
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#78716C] font-[Manrope] hidden sm:block">
              {user?.name || user?.email}
            </span>
            <Button
              data-testid="new-article-button"
              onClick={createArticle}
              className="bg-[#1F1E1D] text-[#FAF9F5] hover:bg-[#1F1E1D]/90 font-[Manrope]"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Article
            </Button>
            <Button
              data-testid="logout-button"
              onClick={handleLogout}
              variant="ghost"
              size="icon"
              className="text-[#78716C] hover:text-[#1F1E1D]"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 md:px-12 py-8">
        {/* Search */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A29E]" strokeWidth={1.5} />
            <input
              data-testid="search-input"
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-[#E6E4DD] rounded-md font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] placeholder:text-[#A8A29E]"
            />
          </div>
          <div className="flex items-center gap-1 bg-[#F0EFEB] rounded-md p-1 shrink-0">
            <button
              data-testid="view-grid-button"
              onClick={() => setView("grid")}
              title="Grid view"
              className={`p-1.5 rounded-sm transition-colors ${view === "grid" ? "bg-white text-[#1F1E1D] shadow-sm" : "text-[#78716C] hover:text-[#1F1E1D]"}`}
            >
              <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
            </button>
            <button
              data-testid="view-board-button"
              onClick={() => setView("board")}
              title="Kanban board (by tag)"
              className={`p-1.5 rounded-sm transition-colors ${view === "board" ? "bg-white text-[#1F1E1D] shadow-sm" : "text-[#78716C] hover:text-[#1F1E1D]"}`}
            >
              <Columns3 className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Status Filter (also a drop target for dragged cards) */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              data-testid={`filter-status-${s}`}
              onClick={() => setActiveStatus(s)}
              onDragOver={(e) => { if (s !== "all") { e.preventDefault(); setDragOverStatus(s); } }}
              onDragLeave={() => setDragOverStatus((cur) => (cur === s ? null : cur))}
              onDrop={(e) => {
                if (s === "all") return;
                e.preventDefault();
                setDragOverStatus(null);
                const articleId = e.dataTransfer.getData("articleId");
                const article = articles.find((a) => a.id === articleId);
                if (article) moveArticleStatus(article, s);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-[Manrope] transition-colors ${
                activeStatus === s
                  ? "bg-[#1F1E1D] text-[#FAF9F5]"
                  : dragOverStatus === s
                  ? "bg-[#C96442] text-white"
                  : "bg-[#F0EFEB] text-[#4A4541] hover:bg-[#E6E4DD]"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
          {view === "grid" && (
            <span className="text-[0.65rem] text-[#A8A29E] font-[Manrope] ml-1">Drag a card here to change its status</span>
          )}
        </div>

        {/* Tag Filter */}
        {view === "grid" && allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8" data-testid="tag-filter-bar">
            <span className="text-xs text-[#78716C] font-[Manrope] mr-1">Tags:</span>
            <button
              data-testid="filter-tag-all"
              onClick={() => setActiveTag("")}
              className={`tag-pill ${!activeTag ? "!bg-[#1F1E1D] !text-[#FAF9F5] !border-[#1F1E1D]" : ""}`}
            >
              All
            </button>
            {allTags.map((t) => (
              <button
                key={t}
                data-testid={`filter-tag-${t}`}
                onClick={() => setActiveTag(t)}
                className={`tag-pill ${activeTag === t ? "!bg-[#1F1E1D] !text-[#FAF9F5] !border-[#1F1E1D]" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {/* Empty state (shared by both views) */}
        {loadingArticles ? (
          <div className="text-sm text-[#78716C] font-[Manrope]">Loading articles...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" data-testid="empty-state">
            <FileText className="w-12 h-12 text-[#E6E4DD] mx-auto mb-4" strokeWidth={1} />
            <p className="text-[#78716C] font-[Manrope] text-sm mb-4">
              {articles.length === 0 ? "No articles yet. Start writing!" : "No articles match your filters."}
            </p>
            {articles.length === 0 && (
              <Button
                data-testid="empty-state-new-article"
                onClick={createArticle}
                className="bg-[#1F1E1D] text-[#FAF9F5] hover:bg-[#1F1E1D]/90 font-[Manrope]"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Article
              </Button>
            )}
          </div>
        ) : view === "board" ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kanban-board">
            {kanbanColumns.map((col) => (
              <div
                key={col.status}
                data-testid={`kanban-column-${col.status}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverStatus(col.status); }}
                onDragLeave={() => setDragOverStatus((s) => (s === col.status ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverStatus(null);
                  const articleId = e.dataTransfer.getData("articleId");
                  const article = articles.find((a) => a.id === articleId);
                  if (article) moveArticleStatus(article, col.status);
                }}
                className={`min-w-0 rounded-lg border transition-colors ${
                  dragOverStatus === col.status ? "border-[#C96442] bg-[#FCEEE8]" : "border-[#E6E4DD] bg-[#F0EFEB]"
                }`}
              >
                <div className="px-3 py-2.5 border-b border-[#E6E4DD] flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1F1E1D] font-[Manrope] uppercase tracking-wider">
                    {col.status}
                  </span>
                  <span className="text-[0.625rem] text-[#A8A29E] font-[Manrope]">{col.articles.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[80px]">
                  {col.articles.map((article) => (
                    <div
                      key={article.id}
                      draggable
                      data-testid={`kanban-card-${article.id}`}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("articleId", article.id);
                      }}
                      onClick={() => navigate(`/articles/${article.id}`)}
                      className="p-3 bg-[#FCFBF8] border border-[#E6E4DD] rounded-md cursor-grab active:cursor-grabbing hover:bg-white transition-colors"
                    >
                      <h4 className="text-sm font-bold text-[#1F1E1D] font-[Manrope] leading-snug line-clamp-2 mb-1.5">
                        {article.title || "Untitled"}
                      </h4>
                      {article.notes && (
                        <p className="text-xs text-[#78716C] font-[Manrope] line-clamp-2 mb-1.5">{article.notes}</p>
                      )}
                      {(article.tags || []).length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {article.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="tag-pill text-[0.6rem]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="articles-grid">
            {filtered.map((article) => (
              <button
                key={article.id}
                draggable
                data-testid={`article-card-${article.id}`}
                onDragStart={(e) => { e.dataTransfer.setData("articleId", article.id); }}
                onClick={() => navigate(`/articles/${article.id}`)}
                className="text-left p-6 bg-[#FCFBF8] border border-[#E6E4DD] rounded-lg hover:bg-[#F0EFEB] transition-colors cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-[#1F1E1D] font-[Manrope] leading-snug line-clamp-2">
                    {article.title || "Untitled"}
                  </h3>
                  <Badge className={`${statusStyles[article.status] || "status-idea"} shrink-0 text-[0.625rem] px-2 py-0.5 rounded-full border-0`}>
                    {article.status}
                  </Badge>
                </div>
                {article.notes && (
                  <p className="text-xs text-[#78716C] font-[Manrope] line-clamp-2 mb-3">
                    {article.notes}
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {(article.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag} className="tag-pill text-[0.625rem]">{tag}</span>
                    ))}
                    {(article.tags || []).length > 3 && (
                      <span className="tag-pill text-[0.625rem]">+{article.tags.length - 3}</span>
                    )}
                  </div>
                  <span className="text-[0.625rem] text-[#A8A29E] font-[Manrope]">
                    {formatDate(article.updated_at)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
