import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Bold, Italic, Heading1, Heading2, Quote, List, Link2, X } from "lucide-react";

function normalizeContent(content) {
  if (!content) return "";
  if (content.includes("<") && content.includes(">")) return content;
  return content.split("\n").filter(Boolean).map(line => `<p>${line}</p>`).join("") || "<p><br></p>";
}

const ToolbarButton = ({ icon: Icon, onAction, active, title }) => (
  <button
    onMouseDown={(e) => { e.preventDefault(); onAction(); }}
    title={title}
    className={`w-8 h-8 flex items-center justify-center rounded transition-colors ${active ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"}`}
  >
    <Icon className="w-4 h-4" strokeWidth={1.5} />
  </button>
);

const RichTextEditor = forwardRef(function RichTextEditor({ content, onChange, articleId }, ref) {
  const editorRef = useRef(null);
  const toolbarRef = useRef(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [wordCount, setWordCount] = useState(0);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const initializedRef = useRef(false);
  const lastArticleIdRef = useRef(null);

  useImperativeHandle(ref, () => ({
    getHTML: () => editorRef.current?.innerHTML || "",
    getText: () => editorRef.current?.textContent || "",
    insertImageAtCursor: (src) => {
      editorRef.current?.focus();
      document.execCommand("insertHTML", false,
        `<figure style="margin:1.5rem 0"><img src="${src}" alt="Screenshot" style="max-width:100%;border-radius:6px;display:block;" /><figcaption style="text-align:center;font-size:0.875rem;color:#78716C;margin-top:0.5rem;font-family:Manrope,sans-serif">Screenshot</figcaption></figure><p><br></p>`
      );
      handleInput();
    },
    copyForMedium: async () => {
      if (!editorRef.current) return false;
      const html = editorRef.current.innerHTML;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([editorRef.current.textContent], { type: "text/plain" }),
          }),
        ]);
        return true;
      } catch {
        return false;
      }
    },
  }));

  // Initialize content when article changes
  useEffect(() => {
    if (articleId !== lastArticleIdRef.current) {
      initializedRef.current = false;
      lastArticleIdRef.current = articleId;
    }
    if (editorRef.current && !initializedRef.current && content !== undefined) {
      editorRef.current.innerHTML = normalizeContent(content);
      initializedRef.current = true;
      updateWordCount();
    }
  }, [content, articleId]);

  const updateWordCount = useCallback(() => {
    if (editorRef.current) {
      const text = editorRef.current.textContent.trim();
      setWordCount(text ? text.split(/\s+/).length : 0);
    }
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
      updateWordCount();
    }
  }, [onChange, updateWordCount]);

  // Toolbar positioning on selection
  const checkSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !editorRef.current?.contains(selection.anchorNode)) {
      setShowToolbar(false);
      setShowLinkInput(false);
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const editorRect = editorRef.current.getBoundingClientRect();
    if (rect.width === 0) { setShowToolbar(false); return; }
    setToolbarPos({
      top: rect.top - editorRect.top - 52,
      left: Math.max(100, Math.min(rect.left - editorRect.left + rect.width / 2, editorRect.width - 100)),
    });
    setShowToolbar(true);
  }, []);

  useEffect(() => {
    const onMouseUp = () => setTimeout(checkSelection, 10);
    const onKeyUp = (e) => { if (e.shiftKey) setTimeout(checkSelection, 10); };
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener("mouseup", onMouseUp);
      editor.addEventListener("keyup", onKeyUp);
    }
    return () => {
      if (editor) {
        editor.removeEventListener("mouseup", onMouseUp);
        editor.removeEventListener("keyup", onKeyUp);
      }
    };
  }, [checkSelection]);

  // Hide toolbar on click outside
  useEffect(() => {
    const onClick = (e) => {
      if (toolbarRef.current?.contains(e.target)) return;
      if (!editorRef.current?.contains(e.target)) {
        setShowToolbar(false);
        setShowLinkInput(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const execFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const toggleBlock = (tag) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const node = selection.anchorNode?.parentElement;
    const current = node?.closest("h1, h2, blockquote, p");
    if (current && current.tagName.toLowerCase() === tag) {
      document.execCommand("formatBlock", false, "p");
    } else {
      document.execCommand("formatBlock", false, tag);
    }
    handleInput();
  };

  const insertLink = () => {
    if (linkUrl.trim()) {
      const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
      execFormat("createLink", url);
    }
    setShowLinkInput(false);
    setLinkUrl("");
  };

  // Handle drop (images from scratchpad)
  const handleDrop = (e) => {
    const imgSrc = e.dataTransfer.getData("text/image-url");
    if (imgSrc) {
      e.preventDefault();
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand("insertHTML", false,
        `<figure style="margin:1.5rem 0"><img src="${imgSrc}" alt="Screenshot" style="max-width:100%;border-radius:6px;display:block;" /><figcaption style="text-align:center;font-size:0.875rem;color:#78716C;margin-top:0.5rem;font-family:Manrope,sans-serif">Screenshot</figcaption></figure><p><br></p>`
      );
      handleInput();
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "b") { e.preventDefault(); execFormat("bold"); }
      if (e.key === "i") { e.preventDefault(); execFormat("italic"); }
      if (e.key === "k") { e.preventDefault(); setShowLinkInput(true); }
    }
  };

  return (
    <div className="relative">
      {/* Floating Toolbar */}
      {showToolbar && (
        <div
          ref={toolbarRef}
          className="absolute z-50 flex items-center gap-0.5 bg-[#1F1E1D] rounded-lg px-1 py-0.5 shadow-2xl"
          style={{ top: `${toolbarPos.top}px`, left: `${toolbarPos.left}px`, transform: "translateX(-50%)" }}
          data-testid="floating-toolbar"
        >
          {!showLinkInput ? (
            <>
              <ToolbarButton icon={Bold} onAction={() => execFormat("bold")} title="Bold (Ctrl+B)" />
              <ToolbarButton icon={Italic} onAction={() => execFormat("italic")} title="Italic (Ctrl+I)" />
              <div className="w-px h-5 bg-white/20 mx-0.5" />
              <ToolbarButton icon={Heading1} onAction={() => toggleBlock("h1")} title="Heading 1" />
              <ToolbarButton icon={Heading2} onAction={() => toggleBlock("h2")} title="Heading 2" />
              <div className="w-px h-5 bg-white/20 mx-0.5" />
              <ToolbarButton icon={Quote} onAction={() => toggleBlock("blockquote")} title="Quote" />
              <ToolbarButton icon={List} onAction={() => execFormat("insertUnorderedList")} title="Bullet List" />
              <div className="w-px h-5 bg-white/20 mx-0.5" />
              <ToolbarButton icon={Link2} onAction={() => setShowLinkInput(true)} title="Link (Ctrl+K)" />
            </>
          ) : (
            <div className="flex items-center gap-1 px-1">
              <input
                autoFocus
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); insertLink(); } if (e.key === "Escape") { setShowLinkInput(false); setLinkUrl(""); } }}
                placeholder="Paste URL..."
                className="bg-transparent text-white text-sm border-none outline-none w-48 placeholder:text-white/40 font-[Manrope]"
                data-testid="toolbar-link-input"
              />
              <button onMouseDown={(e) => { e.preventDefault(); insertLink(); }} className="text-white/70 hover:text-white text-xs font-[Manrope]">Add</button>
              <button onMouseDown={(e) => { e.preventDefault(); setShowLinkInput(false); setLinkUrl(""); }} className="text-white/40 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      )}

      {/* Contenteditable Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onDrop={handleDrop}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("text/image-url")) e.preventDefault(); }}
        onKeyDown={handleKeyDown}
        data-testid="editor-content"
        data-placeholder="Start writing your article..."
        className="editor-contenteditable"
      />

      {/* Word Count */}
      <div className="mt-8 pt-4 border-t border-[#E6E4DD]">
        <span className="word-count" data-testid="word-count">{wordCount} {wordCount === 1 ? "word" : "words"}</span>
      </div>
    </div>
  );
});

export default RichTextEditor;
