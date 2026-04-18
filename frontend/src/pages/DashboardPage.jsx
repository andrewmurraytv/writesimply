import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, LogOut, FileText, Search } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATUSES = ["all", "idea", "draft", "ready", "published"];

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
              SolopreneurWriter
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
        <div className="mb-6">
          <div className="relative max-w-sm">
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
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {STATUSES.map((s) => (
            <button
              key={s}
              data-testid={`filter-status-${s}`}
              onClick={() => setActiveStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium font-[Manrope] transition-colors ${
                activeStatus === s
                  ? "bg-[#1F1E1D] text-[#FAF9F5]"
                  : "bg-[#F0EFEB] text-[#4A4541] hover:bg-[#E6E4DD]"
              }`}
            >
              {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
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

        {/* Articles Grid */}
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="articles-grid">
            {filtered.map((article) => (
              <button
                key={article.id}
                data-testid={`article-card-${article.id}`}
                onClick={() => navigate(`/articles/${article.id}`)}
                className="text-left p-6 bg-[#FCFBF8] border border-[#E6E4DD] rounded-lg hover:bg-[#F0EFEB] transition-colors"
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
