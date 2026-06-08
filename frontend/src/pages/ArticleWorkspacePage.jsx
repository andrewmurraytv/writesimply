import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Save, Sparkles, X, Plus, Link as LinkIcon, PanelLeftClose, PanelLeft, ClipboardCopy, FileText, ChevronDown } from "lucide-react";
import PromptDrawer from "@/components/PromptDrawer";
import ScreenshotUploader from "@/components/ScreenshotUploader";
import RichTextEditor from "@/components/RichTextEditor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ArticleWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const editorRef = useRef(null);

  const [article, setArticle] = useState(null);
  const [title, setTitle] = useState("");
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
          setNotes(data.notes || "");
          setArticleContent(data.article_content || "");
          setStatus(data.status || "idea");
          setTags(data.tags || []);
          setReferenceLinks(data.reference_links || []);
          setScreenshotPaths(data.screenshot_paths || []);
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
  }, [title, notes, articleContent, status, tags, referenceLinks, screenshotPaths]);

  const saveArticle = useCallback(async (isAutoSave = false) => {
    if (!article) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${API}/articles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, notes, article_content: articleContent, status, tags, reference_links: referenceLinks, screenshot_paths: screenshotPaths,
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
  }, [article, id, title, notes, articleContent, status, tags, referenceLinks, screenshotPaths, apiFetch]);

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
  const onScreenshotUploaded = (path) => setScreenshotPaths([...screenshotPaths, path]);
  const removeScreenshot = (index) => setScreenshotPaths(screenshotPaths.filter((_, i) => i !== index));

  // Copy for Medium
  const handleCopyForMedium = async () => {
    if (editorRef.current?.copyForMedium) {
      const ok = await editorRef.current.copyForMedium();
      if (ok) toast.success("Copied as rich text! Paste into Medium.");
      else toast.error("Copy failed");
    }
  };

  // Copy as Markdown
  const handleCopyMarkdown = async () => {
    if (editorRef.current?.copyAsMarkdown) {
      const ok = await editorRef.current.copyAsMarkdown(title);
      if (ok) toast.success("Copied as Markdown!");
      else toast.error("Copy failed");
    }
  };

  // Download as .md file
  const handleDownloadMarkdown = () => {
    if (editorRef.current?.getMarkdown) {
      const md = editorRef.current.getMarkdown(title);
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
        </div>
        <div className="flex items-center gap-2">
          <span className="save-indicator hidden sm:block">
            {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
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
            <DropdownMenuContent align="end" className="bg-[#FAF9F5] border-[#E6E4DD]">
              <DropdownMenuItem data-testid="copy-for-medium" onClick={handleCopyForMedium} className="font-[Manrope] text-xs cursor-pointer">
                <ClipboardCopy className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                Copy for Medium (Rich Text)
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="copy-markdown" onClick={handleCopyMarkdown} className="font-[Manrope] text-xs cursor-pointer">
                <FileText className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                Copy as Markdown
              </DropdownMenuItem>
              <DropdownMenuItem data-testid="download-markdown" onClick={handleDownloadMarkdown} className="font-[Manrope] text-xs cursor-pointer">
                <FileText className="w-3.5 h-3.5 mr-2" strokeWidth={1.5} />
                Download .md file
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
                draggable
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-[#78716C] mb-1.5 font-[Manrope] uppercase tracking-wider">Tags</label>
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
            />
          </div>
        </div>
      </div>

      {/* Prompt Drawer */}
      <PromptDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </div>
  );
}
