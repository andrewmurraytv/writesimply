import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Sparkles, X, Plus, Link as LinkIcon, PanelLeftClose, PanelLeft, ClipboardCopy, FileText, ChevronDown, Focus, ListTree, Wand2, BarChart3, Code } from "lucide-react";
import PromptDrawer from "@/components/PromptDrawer";
import ScreenshotUploader from "@/components/ScreenshotUploader";
import RichTextEditor from "@/components/RichTextEditor";
import PomodoroTimer from "@/components/PomodoroTimer";
import AmbientSound from "@/components/AmbientSound";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCount = (n) => {
  if (typeof n !== "number") return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

export default function ArticleWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const editorRef = useRef(null);

  const [article, setArticle] = useState(null);
  const [title, setTitle] = useState("");
  const [subheadline, setSubheadline] = useState("");
  const [notes, setNotes] = useState("");
  const [articleContent, setArticleContent] = useState("");
  const [status, setStatus] = useState("idea");
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState("");
  const [referenceLinks, setReferenceLinks] = useState([]);
  const [screenshotPaths, setScreenshotPaths] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [newLinkLabel, setNewLinkLabel] = useState("");
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [outlineMode, setOutlineMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTagBrowser, setShowTagBrowser] = useState(false);
  const [tagCatalog, setTagCatalog] = useState(null);
  const [tagSearch, setTagSearch] = useState("");
  const [shortlist, setShortlist] = useState([]);
  const [shortlistOnly, setShortlistOnly] = useState(true);

  const hasChangesRef = useRef(false);
  const autoSaveTimerRef = useRef(null);
  const saveRef = useRef(null);

  // Load article
  useEffect(() => {
    const loadArticle = async () => {
      try {
        const res = await apiFetch(`${API}/articles/${id}`);
        if (res.ok) {
          const data = await res.json();
          setArticle(data);
          setTitle(data.title || "");
          setSubheadline(data.subheadline || "");
          setNotes(data.notes || "");
          setArticleContent(data.article_content || "");
          setStatus(data.status || "idea");
          setTags(data.tags || []);
          setReferenceLinks(data.reference_links || []);
          setScreenshotPaths((data.screenshot_paths || []).map(s => typeof s === "string" ? { path: s, name: "" } : s));
        } else {
          toast.error("Article not found");
          navigate("/");
        }
      } catch {
        toast.error("Failed to load article");
        navigate("/");
      }
    };
    loadArticle();
  }, [id]);

  // Mark changes
  useEffect(() => {
    if (article) hasChangesRef.current = true;
  }, [title, subheadline, notes, articleContent, status, tags, referenceLinks, screenshotPaths]);

  const saveArticle = useCallback(async (isAutoSave = false) => {
    if (!article) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, subheadline, notes, article_content: articleContent, status, tags, reference_links: referenceLinks, screenshot_paths: screenshotPaths,
        }),
      });
      if (res.ok) {
        hasChangesRef.current = false;
        setLastSaved(new Date());
        if (!isAutoSave) toast.success("Saved");
      }
    } catch {
      if (!isAutoSave) toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [article, id, title, subheadline, notes, articleContent, status, tags, referenceLinks, screenshotPaths, apiFetch]);

  // Keep saveRef updated
  useEffect(() => { saveRef.current = saveArticle; }, [saveArticle]);

  // Auto-save every 30 seconds
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      if (hasChangesRef.current && saveRef.current) saveRef.current(true);
    }, 30000);
    return () => clearInterval(autoSaveTimerRef.current);
  }, []);

  // Tag handling
  const addTag = (value) => {
    const newTags = value.split(",").map((t) => t.trim()).filter((t) => t && !tags.includes(t));
    if (newTags.length) setTags([...tags, ...newTags]);
    setTagInput("");
  };
  const removeTag = (tag) => setTags(tags.filter((t) => t !== tag));

  // AI suggestions (headline / subheadline / tags)
  const requestSuggestions = async () => {
    setSuggesting(true);
    try {
      const res = await apiFetch(`${API}/articles/${id}/suggest-metadata`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(true);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Failed to get suggestions");
      }
    } catch {
      toast.error("Failed to get suggestions");
    } finally {
      setSuggesting(false);
    }
  };
  const openTagBrowser = async () => {
    setShowTagBrowser((open) => !open);
    if (tagCatalog) return;
    try {
      const [cat, sl] = await Promise.all([
        apiFetch(`${API}/medium-tags`),
        apiFetch(`${API}/tag-shortlist`),
      ]);
      if (cat.ok) setTagCatalog(await cat.json());
      if (sl.ok) setShortlist((await sl.json()).tags || []);
    } catch {
      toast.error("Could not load tag data");
    }
  };

  const toggleShortlist = async (tag) => {
    const next = shortlist.includes(tag)
      ? shortlist.filter((t) => t !== tag)
      : [...shortlist, tag];
    setShortlist(next);
    try {
      const res = await apiFetch(`${API}/tag-shortlist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      toast.error("Could not save shortlist");
      setShortlist(shortlist);
    }
  };

  // One list, but ratios only mean something within a group, so each row keeps
  // its group label rather than being merged into a single ranking.
  const browsableTags = useMemo(() => {
    if (!tagCatalog) return [];
    const rows = [
      ...(tagCatalog.topics || []).map((t) => ({ ...t, group: "topic" })),
      ...(tagCatalog.niche || []).map((t) => ({ ...t, group: "niche" })),
    ];
    const q = tagSearch.trim().toLowerCase();
    return rows
      .filter((t) => !q || t.tag.toLowerCase().includes(q))
      // A search should reach the whole catalogue, so the shortlist filter only
      // applies while browsing.
      .filter((t) => !shortlistOnly || q || shortlist.includes(t.tag))
      .sort((a, b) => b.value - a.value);
  }, [tagCatalog, tagSearch, shortlistOnly, shortlist]);

  const applyHeadline = (h) => setTitle(h);
  const applySubheadline = (s) => setSubheadline(s);
  const toggleTag = (t) =>
    setTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  const applyTag = (t) => { if (!tags.includes(t)) setTags([...tags, t]); };

  // Reference links
  const addLink = () => {
    if (!newLinkUrl.trim()) return;
    if (referenceLinks.length >= 5) { toast.error("Maximum 5 reference links"); return; }
    setReferenceLinks([...referenceLinks, { url: newLinkUrl.trim(), label: newLinkLabel.trim() || "" }]);
    setNewLinkUrl("");
    setNewLinkLabel("");
    setShowLinkForm(false);
  };
  const removeLink = (index) => setReferenceLinks(referenceLinks.filter((_, i) => i !== index));

  // Screenshots
  const onScreenshotUploaded = (shot) => setScreenshotPaths([...screenshotPaths, shot]);
  const removeScreenshot = (index) => setScreenshotPaths(screenshotPaths.filter((_, i) => i !== index));
  const renameScreenshot = (index, newName) => {
    setScreenshotPaths(screenshotPaths.map((s, i) => i === index ? { ...s, name: newName } : s));
  };

  // Copy for Medium
  const handleCopyForMedium = async () => {
    if (editorRef.current?.copyForMedium) {
      const ok = await editorRef.current.copyForMedium({ title, subheadline });
      if (ok) toast.success("Copied with title + subtitle. Paste into a new Medium story.");
      else toast.error("Copy failed");
    }
  };

  // Copy clean HTML for WordPress's code editor / Custom HTML block
  const handleCopyHtml = async () => {
    if (editorRef.current?.copyAsHtml) {
      const ok = await editorRef.current.copyAsHtml({ title, subheadline });
      if (ok) toast.success("HTML copied. Paste into WordPress's code editor.");
      else toast.error("Copy failed");
    }
  };

  // Copy as Markdown
  const handleCopyMarkdown = async () => {
    if (editorRef.current?.copyAsMarkdown) {
      const ok = await editorRef.current.copyAsMarkdown(title, subheadline);
      if (ok) toast.success("Copied as Markdown!");
      else toast.error("Copy failed");
    }
  };

  // Download as .md file
  const handleDownloadMarkdown = () => {
    if (editorRef.current?.getMarkdown) {
      const md = editorRef.current.getMarkdown(title, subheadline);
      const blob = new Blob([md], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(title || "untitled").toLowerCase().replace(/\s+/g, "-")}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded as Markdown");
    }
  };

  // Keyboard shortcut: Ctrl+S to save
  useEffect(() => {
    const handleKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveArticle(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [saveArticle]);

  if (!article) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF9F5]">
        <div className="text-sm text-[#78716C] font-[Manrope]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5]" data-testid="article-workspace">
      {/* Top Bar */}
      <header className="h-14 border-b border-[#E6E4DD] bg-[#FAF9F5] sticky top-0 z-40 flex items-center px-4 md:px-6 justify-between">
        <div className="flex items-center gap-3">
          <Button
            data-testid="back-to-dashboard"
            variant="ghost"
            size="icon"
            onClick={() => { if (hasChangesRef.current) saveArticle(); navigate("/"); }}
            className="text-[#78716C] hover:text-[#1F1E1D] h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          </Button>
          <Button
            data-testid="toggle-panel"
            variant="ghost"
            size="icon"
            onClick={() => setPanelCollapsed(!panelCollapsed)}
            className="text-[#78716C] hover:text-[#1F1E1D] h-8 w-8"
            title={panelCollapsed ? "Show scratchpad" : "Hide scratchpad"}
          >
            {panelCollapsed ? <PanelLeft className="w-4 h-4" strokeWidth={1.5} /> : <PanelLeftClose className="w-4 h-4" strokeWidth={1.5} />}
          </Button>
          <span className="text-sm font-medium text-[#1F1E1D] font-[Manrope] truncate max-w-[200px]">
            {title || "Untitled"}
          </span>
          <div className="hidden sm:flex items-center gap-1 ml-2 pl-2 border-l border-[#E6E4DD]">
            <PomodoroTimer />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AmbientSound />
          <span className="text-xs text-[#78716C] font-[Manrope] tabular-nums hidden sm:block" data-testid="word-count">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </span>
          <span className="save-indicator hidden sm:block">
            {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          <Button
            data-testid="toggle-focus-mode"
            variant="ghost"
            size="sm"
            onClick={() => setFocusMode(!focusMode)}
            className={`font-[Manrope] text-xs hidden sm:flex h-8 ${focusMode ? "bg-[#1F1E1D] text-[#FAF9F5] hover:bg-[#1F1E1D]/90" : "text-[#78716C] hover:text-[#1F1E1D]"}`}
            title="Toggle focus mode"
          >
            <Focus className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
            Focus
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="export-menu"
                variant="ghost"
                size="sm"
                className="text-[#78716C] hover:text-[#1F1E1D] font-[Manrope] text-xs hidden sm:flex"
              >
                <ClipboardCopy className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
                Export
                <ChevronDown className="w-3 h-3 ml-0.5" strokeWidth={1.5} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#FAF9F5] border-[#E6E4DD] w-72">
              <DropdownMenuItem data-testid="copy-for-medium" onClick={handleCopyForMedium} className="font-[Manrope] text-xs cursor-pointer items-start py-2">
                <ClipboardCopy className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" strokeWidth={1.5} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Medium</span>
                  <span className="text-[0.65rem] text-[#78716C] leading-snug">
                    Rich text with title + subtitle. Paste straight into a new story.
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="copy-html" onClick={handleCopyHtml} className="font-[Manrope] text-xs cursor-pointer items-start py-2">
                <Code className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" strokeWidth={1.5} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">WordPress</span>
                  <span className="text-[0.65rem] text-[#78716C] leading-snug">
                    HTML. Paste into the code editor, or a Custom HTML block.
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="copy-markdown" onClick={handleCopyMarkdown} className="font-[Manrope] text-xs cursor-pointer items-start py-2">
                <FileText className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" strokeWidth={1.5} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Markdown</span>
                  <span className="text-[0.65rem] text-[#78716C] leading-snug">
                    Copy for Ghost, Substack, GitHub or a notes app.
                  </span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="download-markdown" onClick={handleDownloadMarkdown} className="font-[Manrope] text-xs cursor-pointer items-start py-2">
                <FileText className="w-3.5 h-3.5 mr-2 mt-0.5 shrink-0" strokeWidth={1.5} />
                <span className="flex flex-col gap-0.5">
                  <span className="font-medium">Download .md</span>
                  <span className="text-[0.65rem] text-[#78716C] leading-snug">
                    Save the Markdown as a file.
                  </span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            data-testid="save-article-button"
            onClick={() => saveArticle(false)}
            disabled={saving}
            variant="outline"
            size="sm"
            className="border-[#E6E4DD] font-[Manrope] text-[#1F1E1D] h-8"
          >
            <Save className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
            Save
          </Button>
          <Button
            data-testid="open-prompts-drawer"
            onClick={() => setDrawerOpen(true)}
            size="sm"
            className="bg-[#1F1E1D] text-[#FAF9F5] hover:bg-[#1F1E1D]/90 font-[Manrope] h-8"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" strokeWidth={1.5} />
            Prompts
          </Button>
        </div>
      </header>

      {/* Split Panels */}
      <div className="flex">
        {/* Left Panel - Scratchpad (Collapsible) */}
        <div
          className={`border-r border-[#E6E4DD] bg-[#F0EFEB] panel-scroll transition-all duration-300 ease-in-out overflow-hidden ${
            panelCollapsed ? "w-0 p-0 border-r-0" : "w-[35%] min-w-[320px] p-6"
          }`}
          data-testid="scratchpad-panel"
        >
          <div className={`space-y-6 ${panelCollapsed ? "opacity-0" : "opacity-100"} transition-opacity duration-200`}>
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] mb-1.5 font-[Manrope] uppercase tracking-wider">Title</label>
              <input
                data-testid="scratchpad-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title..."
                className="scratchpad-title"
              />
            </div>

            {/* Subheadline */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] mb-1.5 font-[Manrope] uppercase tracking-wider">Subheadline</label>
              <input
                data-testid="scratchpad-subheadline"
                type="text"
                value={subheadline}
                onChange={(e) => setSubheadline(e.target.value)}
                placeholder="Subtitle for Medium..."
                className="w-full text-sm px-3 py-1.5 border border-[#E6E4DD] rounded-sm font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] bg-transparent"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] mb-1.5 font-[Manrope] uppercase tracking-wider">Notes</label>
              <textarea
                data-testid="scratchpad-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Raw ideas, research notes, brainstorms..."
                className="scratchpad-notes"
                rows={6}
              />
            </div>

            {/* Reference Links */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#78716C] font-[Manrope] uppercase tracking-wider">Reference Links</label>
                {referenceLinks.length < 5 && (
                  <button
                    data-testid="add-reference-link-button"
                    onClick={() => setShowLinkForm(!showLinkForm)}
                    className="text-xs text-[#C96442] hover:text-[#A8502F] font-[Manrope] font-medium flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                )}
              </div>
              {showLinkForm && (
                <div className="mb-3 p-3 bg-white rounded-md border border-[#E6E4DD] space-y-2">
                  <input data-testid="link-url-input" type="url" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="https://..." className="w-full text-sm px-3 py-1.5 border border-[#E6E4DD] rounded-sm font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] bg-transparent" />
                  <input data-testid="link-label-input" type="text" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Label (optional)" className="w-full text-sm px-3 py-1.5 border border-[#E6E4DD] rounded-sm font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] bg-transparent" />
                  <div className="flex gap-2">
                    <Button data-testid="save-link-button" size="sm" onClick={addLink} className="bg-[#1F1E1D] text-[#FAF9F5] text-xs font-[Manrope]">Add</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowLinkForm(false)} className="text-xs font-[Manrope]">Cancel</Button>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                {referenceLinks.map((link, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm group" data-testid={`reference-link-${i}`}>
                    <LinkIcon className="w-3 h-3 text-[#A8A29E] shrink-0" strokeWidth={1.5} />
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[#C96442] hover:underline truncate font-[Manrope] text-xs">{link.label || link.url}</a>
                    <button onClick={() => removeLink(i)} className="opacity-0 group-hover:opacity-100 text-[#A8A29E] hover:text-[#991B1B] transition-opacity" data-testid={`remove-link-${i}`}><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            </div>

            {/* Screenshots - Draggable */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] mb-1.5 font-[Manrope] uppercase tracking-wider">
                Screenshots
                <span className="normal-case font-normal text-[#A8A29E] ml-2">drag into editor</span>
              </label>
              <ScreenshotUploader
                screenshots={screenshotPaths}
                onUploaded={onScreenshotUploaded}
                onRemove={removeScreenshot}
                onRename={renameScreenshot}
                draggable
                titleHint={title}
              />
            </div>

            {/* Tags */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-[#78716C] font-[Manrope] uppercase tracking-wider">Tags</label>
                <div className="flex items-center gap-3">
                  <button
                    data-testid="browse-tags-button"
                    onClick={openTagBrowser}
                    className="text-xs text-[#78716C] hover:text-[#1F1E1D] font-[Manrope] font-medium flex items-center gap-1"
                  >
                    <BarChart3 className="w-3 h-3" /> Browse
                  </button>
                  <button
                    data-testid="suggest-metadata-button"
                    onClick={requestSuggestions}
                    disabled={suggesting}
                    className="text-xs text-[#C96442] hover:text-[#A8502F] font-[Manrope] font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    <Wand2 className="w-3 h-3" /> {suggesting ? "Thinking..." : "AI Suggest"}
                  </button>
                </div>
              </div>

              {showTagBrowser && (
                <div className="mb-3 p-3 bg-white rounded-md border border-[#E6E4DD]" data-testid="tag-browser">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[0.65rem] font-medium text-[#1F1E1D] font-[Manrope] uppercase tracking-wider">Compare tags</span>
                    <button onClick={() => setShowTagBrowser(false)} className="text-[#A8A29E] hover:text-[#991B1B]" data-testid="close-tag-browser">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    data-testid="tag-browser-search"
                    type="text"
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    placeholder="Search all tags..."
                    className="w-full text-xs px-2 py-1.5 mb-2 border border-[#E6E4DD] rounded-sm font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D]"
                  />
                  <div className="flex items-center justify-between mb-1.5">
                    <button
                      data-testid="toggle-shortlist-only"
                      onClick={() => setShortlistOnly((v) => !v)}
                      disabled={!!tagSearch.trim()}
                      className={`text-[0.65rem] font-[Manrope] px-2 py-0.5 rounded-full transition-colors disabled:opacity-40 ${
                        shortlistOnly && !tagSearch.trim()
                          ? "bg-[#1F1E1D] text-[#FAF9F5]"
                          : "bg-[#F0EFEB] text-[#4A4541] hover:bg-[#E6E4DD]"
                      }`}
                    >
                      ★ My shortlist ({shortlist.length})
                    </button>
                    <span className="text-[0.55rem] text-[#A8A29E] font-[Manrope]">
                      {tagSearch.trim() ? "searching all tags" : "★ to add/remove"}
                    </span>
                  </div>
                  {!tagCatalog ? (
                    <p className="text-[0.65rem] text-[#A8A29E] font-[Manrope]">Loading…</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-[0.6rem] text-[#A8A29E] font-[Manrope] px-1 pb-1 border-b border-[#F0EFEB]">
                        <span>tag</span>
                        <span>followers · per story</span>
                      </div>
                      <div className="max-h-56 overflow-y-auto divide-y divide-[#F5F4F1]">
                        {browsableTags.map((t) => (
                          <div key={`${t.group}-${t.tag}`} className="flex items-center gap-1 hover:bg-[#F0EFEB] transition-colors">
                            <button
                              onClick={() => toggleShortlist(t.tag)}
                              data-testid={`star-tag-${t.tag}`}
                              title={shortlist.includes(t.tag) ? "Remove from shortlist" : "Add to shortlist"}
                              className={`shrink-0 px-1 text-xs ${shortlist.includes(t.tag) ? "text-[#C96442]" : "text-[#D6D3CE] hover:text-[#A8A29E]"}`}
                            >
                              {shortlist.includes(t.tag) ? "★" : "☆"}
                            </button>
                            <button
                              onClick={() => applyTag(t.tag)}
                              disabled={tags.includes(t.tag)}
                              data-testid={`browse-tag-${t.tag}`}
                              className="flex-1 min-w-0 flex items-center justify-between gap-2 text-xs px-1 py-1.5 font-[Manrope] text-[#1F1E1D] disabled:opacity-40 text-left"
                            >
                              <span className="truncate">
                                {t.tag}
                                <span className={`ml-1.5 text-[0.55rem] uppercase ${t.group === "topic" ? "text-[#C96442]" : "text-[#A8A29E]"}`}>
                                  {t.group}
                                </span>
                              </span>
                              <span className="shrink-0 text-[0.6rem] text-[#78716C] tabular-nums">
                                {formatCount(t.followers)} · {t.value}
                              </span>
                            </button>
                          </div>
                        ))}
                        {browsableTags.length === 0 && (
                          <p className="text-[0.65rem] text-[#A8A29E] font-[Manrope] py-2">No tags match.</p>
                        )}
                      </div>
                      <p className="text-[0.55rem] text-[#A8A29E] font-[Manrope] leading-relaxed mt-2">
                        Per story = followers ÷ stories; higher means a bigger audience for the
                        amount already published. Topics have far larger follower bases than
                        niche tags, so compare within a group, not across.
                      </p>
                    </>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span key={tag} className="tag-pill" data-testid={`tag-${tag}`}>
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-1 text-[#78716C] hover:text-[#991B1B]" data-testid={`remove-tag-${tag}`}><X className="w-2.5 h-2.5" /></button>
                  </span>
                ))}
              </div>
              <input
                data-testid="tags-input"
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder="Add tags (comma separated)..."
                className="w-full text-sm px-3 py-1.5 border border-[#E6E4DD] rounded-sm font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] bg-transparent"
              />

              {showSuggestions && suggestions && (
                <div className="mt-3 p-3 bg-white rounded-md border border-[#E6E4DD] space-y-3" data-testid="ai-suggestions-panel">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[#1F1E1D] font-[Manrope] uppercase tracking-wider">AI Suggestions</span>
                    <button onClick={() => setShowSuggestions(false)} className="text-[#A8A29E] hover:text-[#991B1B]" data-testid="close-suggestions"><X className="w-3.5 h-3.5" /></button>
                  </div>

                  {suggestions.headlines?.length > 0 && (
                    <div>
                      <div className="text-[0.65rem] text-[#78716C] font-[Manrope] uppercase tracking-wider mb-1">Headlines</div>
                      <div className="space-y-1">
                        {suggestions.headlines.map((h, i) => (
                          <button key={i} onClick={() => applyHeadline(h)} data-testid={`suggested-headline-${i}`} className="block w-full text-left text-xs px-2 py-1.5 rounded-sm bg-[#F0EFEB] hover:bg-[#E6E4DD] font-[Manrope] text-[#1F1E1D] transition-colors">
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {suggestions.subheadlines?.length > 0 && (
                    <div>
                      <div className="text-[0.65rem] text-[#78716C] font-[Manrope] uppercase tracking-wider mb-1">Subheadlines</div>
                      <div className="space-y-1">
                        {suggestions.subheadlines.map((s, i) => (
                          <button key={i} onClick={() => applySubheadline(s)} data-testid={`suggested-subheadline-${i}`} className="block w-full text-left text-xs px-2 py-1.5 rounded-sm bg-[#F0EFEB] hover:bg-[#E6E4DD] font-[Manrope] text-[#1F1E1D] transition-colors">
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(suggestions.topics || suggestions.niches) && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[0.65rem] text-[#78716C] font-[Manrope] uppercase tracking-wider">Pick your tags</div>
                        <span className={`text-[0.6rem] font-[Manrope] tabular-nums ${tags.length > 5 ? "text-[#991B1B] font-medium" : "text-[#A8A29E]"}`} data-testid="tag-count">
                          {tags.length}/5 chosen
                        </span>
                      </div>

                      {[
                        { key: "topics", label: "Topics — where the audience is" },
                        { key: "niches", label: "Niches — precise, barely contested" },
                      ].map(({ key, label }) => (
                        (suggestions[key] || []).length > 0 && (
                          <div key={key} className="mb-2">
                            <div className="text-[0.6rem] text-[#A8A29E] font-[Manrope] mb-1">{label}</div>
                            <div className="space-y-1">
                              {suggestions[key].map((t, i) => {
                                const stats = suggestions.tag_stats?.[t];
                                const chosen = tags.includes(t);
                                return (
                                  <button
                                    key={i}
                                    onClick={() => toggleTag(t)}
                                    data-testid={`suggested-tag-${t}`}
                                    className={`w-full flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded-md font-[Manrope] transition-colors text-left border ${
                                      chosen
                                        ? "bg-[#1F1E1D] text-[#FAF9F5] border-[#1F1E1D]"
                                        : "bg-[#F0EFEB] text-[#1F1E1D] border-transparent hover:bg-[#E6E4DD]"
                                    }`}
                                  >
                                    <span className="truncate">{chosen ? "✓" : "+"} {t}</span>
                                    <span className={`shrink-0 text-[0.6rem] tabular-nums ${chosen ? "text-[#E6E4DD]" : "text-[#78716C]"}`}>
                                      {stats
                                        ? `${formatCount(stats.followers)} · ${stats.value}/story`
                                        : "no data"}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )
                      ))}

                      {tags.length > 5 && (
                        <p className="text-[0.6rem] text-[#991B1B] font-[Manrope] mb-1">
                          Medium only accepts 5 tags — remove {tags.length - 5} before publishing.
                        </p>
                      )}

                      {suggestions.tag_rationale && (
                        <p className="text-[0.6rem] text-[#78716C] font-[Manrope] leading-relaxed mt-1.5">
                          {suggestions.tag_rationale}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] mb-1.5 font-[Manrope] uppercase tracking-wider">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="status-select" className="w-full bg-white border-[#E6E4DD] font-[Manrope] text-sm focus:ring-[#1F1E1D]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Right Panel - Editor */}
        <div className="flex-1 panel-scroll bg-[#FAF9F5]" data-testid="editor-panel">
          <div className="max-w-[680px] mx-auto px-6 md:px-0 py-12">
            {/* Title */}
            <textarea
              data-testid="editor-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="editor-title mb-8"
              rows={1}
              onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
            />

            {/* Rich Text Editor */}
            <RichTextEditor
              ref={editorRef}
              content={articleContent}
              onChange={setArticleContent}
              articleId={id}
              focusMode={focusMode}
              onWordCountChange={setWordCount}
            />
          </div>
        </div>
      </div>

      {/* Prompt Drawer */}
      <PromptDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
