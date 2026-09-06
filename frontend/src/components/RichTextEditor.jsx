import { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { Bold, Italic, Heading1, Heading2, Quote, List, Link2, X } from "lucide-react";

function normalizeContent(content) {
  if (!content) return "";
  if (content.includes("<") && content.includes(">")) return content;
  return content.split("\n").filter(Boolean).map(line => `<p>${line}</p>`).join("") || "<p><br></p>";
}

function htmlToMarkdown(editorEl, articleTitle) {
  const lines = [];
  if (articleTitle) lines.push(`# ${articleTitle}`, "");
  const processNode = (node) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    const childText = () => Array.from(node.childNodes).map(processNode).join("");
    switch (tag) {
      case "h1": return `# ${childText()}\n\n`;
      case "h2": return `## ${childText()}\n\n`;
      case "h3": return `### ${childText()}\n\n`;
      case "p": return `${childText()}\n\n`;
      case "br": return "\n";
      case "strong": case "b": return `**${childText()}**`;
      case "em": case "i": return `*${childText()}*`;
      case "a": return `[${childText()}](${node.getAttribute("href") || ""})`;
      case "blockquote": return `> ${childText().trim().replace(/\n/g, "\n> ")}\n\n`;
      case "ul": return Array.from(node.children).map(li => `- ${processNode(li).trim()}`).join("\n") + "\n\n";
      case "ol": return Array.from(node.children).map((li, i) => `${i + 1}. ${processNode(li).trim()}`).join("\n") + "\n\n";
      case "li": return childText();
      case "img": return `![${node.alt || "image"}](${node.src || ""})\n\n`;
      case "figure": {
        const img = node.querySelector("img");
        const caption = node.querySelector("figcaption");
        if (img) return `![${caption?.textContent || img.alt || "image"}](${img.src || ""})\n\n`;
        return childText();
      }
      case "div": return `${childText()}\n`;
      default: return childText();
    }
  };
  const body = Array.from(editorEl.childNodes).map(processNode).join("");
  lines.push(body.replace(/\n{3,}/g, "\n\n").trim());
  return lines.join("\n");
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

const RichTextEditor = forwardRef(function RichTextEditor({ content, onChange, articleId, focusMode = false, outlineMode = false, onOutlineJump, onWordCountChange }, ref) {
  const editorRef = useRef(null);
  const toolbarRef = useRef(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [headings, setHeadings] = useState([]);
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
    copyAsMarkdown: async (articleTitle) => {
      if (!editorRef.current) return false;
      const md = htmlToMarkdown(editorRef.current, articleTitle);
      try {
        await navigator.clipboard.writeText(md);
        return true;
      } catch {
        return false;
      }
    },
    getMarkdown: (articleTitle) => {
      if (!editorRef.current) return "";
      return htmlToMarkdown(editorRef.current, articleTitle);
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
      extractHeadings();
    }
  }, [content, articleId]);

  const updateWordCount = useCallback(() => {
    if (!editorRef.current) return;
    // innerText, not textContent: textContent joins block elements with no
    // separator, so the last word of one paragraph merges with the first word
    // of the next ("...world" + "Foo..." = one word) and the count runs low.
    const text = (editorRef.current.innerText || "").trim();
    onWordCountChange?.(text ? text.split(/\s+/).filter(Boolean).length : 0);
  }, [onWordCountChange]);

  const extractHeadings = useCallback(() => {
    if (!editorRef.current) return;
    const els = editorRef.current.querySelectorAll("h1, h2, h3");
    const h = Array.from(els).map((el, i) => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent.trim(),
      index: i,
      element: el,
    }));
    setHeadings(h);
  }, []);

  const handleInput = useCallback(() => {
    if (editorRef.current && onChange) {
      onChange(editorRef.current.innerHTML);
      updateWordCount();
      extractHeadings();
    }
  }, [onChange, updateWordCount, extractHeadings]);

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
      const imgName = e.dataTransfer.getData("text/image-name") || "Screenshot";
      const range = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand("insertHTML", false,
        `<figure style="margin:1.5rem 0"><img src="${imgSrc}" alt="${imgName}" style="max-width:100%;border-radius:6px;display:block;" /><figcaption style="text-align:center;font-size:0.875rem;color:#78716C;margin-top:0.5rem;font-family:Manrope,sans-serif">${imgName}</figcaption></figure><p><br></p>`
      );
      handleInput();
    }
  };

  // Focus mode: track active block
  const [activeBlockIndex, setActiveBlockIndex] = useState(-1);

  const updateActiveBlock = useCallback(() => {
    if (!focusMode || !editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode || !editorRef.current.contains(sel.anchorNode)) return;
    let node = sel.anchorNode;
    while (node && node.parentElement !== editorRef.current) node = node.parentElement;
    if (!node) return;
    const children = Array.from(editorRef.current.children);
    const idx = children.indexOf(node);
    if (idx !== -1) setActiveBlockIndex(idx);
  }, [focusMode]);

  useEffect(() => {
    if (!focusMode) { setActiveBlockIndex(-1); return; }
    const editor = editorRef.current;
    if (!editor) return;
    const handler = () => setTimeout(updateActiveBlock, 10);
    editor.addEventListener("keyup", handler);
    editor.addEventListener("click", handler);
    handler();
    return () => { editor.removeEventListener("keyup", handler); editor.removeEventListener("click", handler); };
  }, [focusMode, updateActiveBlock]);

  // Apply focus mode dimming to editor children
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    Array.from(el.children).forEach((child, i) => {
      child.style.transition = "opacity 0.3s ease";
      if (focusMode && activeBlockIndex >= 0) {
        child.style.opacity = Math.abs(i - activeBlockIndex) <= 1 ? "1" : "0.15";
      } else {
        child.style.opacity = "1";
      }
    });
  }, [focusMode, activeBlockIndex]);

  // Keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === "b") { e.preventDefault(); execFormat("bold"); }
      if (e.key === "i") { e.preventDefault(); execFormat("italic"); }
      if (e.key === "k") { e.preventDefault(); setShowLinkInput(true); }
    }
  };

  const scrollToHeading = (heading) => {
    heading.element?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Place cursor at the heading
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(heading.element);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    heading.element.focus();
    if (onOutlineJump) onOutlineJump();
  };

  return (
    <div className="relative">
      {/* Outline Mode Overlay */}
      {outlineMode && (
        <div className="absolute inset-0 z-30 bg-[#FAF9F5]/95 backdrop-blur-sm rounded-lg" data-testid="outline-panel">
          <div className="py-4">
            <p className="text-xs font-medium text-[#A8A29E] font-[Manrope] uppercase tracking-wider mb-6">Article Outline</p>
            {headings.length === 0 ? (
              <div className="text-sm text-[#A8A29E] font-[Manrope] italic">
                No headings yet. Select text and use H1 or H2 in the toolbar to create structure.
              </div>
            ) : (
              <div className="space-y-1">
                {headings.map((h, i) => (
                  <button
                    key={i}
                    data-testid={`outline-heading-${i}`}
                    onClick={() => scrollToHeading(h)}
                    className={`w-full text-left py-2 px-3 rounded-md transition-colors hover:bg-[#F0EFEB] group font-[Lora] ${
                      h.tag === "h1" ? "text-lg font-semibold text-[#1F1E1D]" :
                      h.tag === "h2" ? "text-base font-medium text-[#4A4541] pl-6" :
                      "text-sm text-[#78716C] pl-10"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`shrink-0 text-[0.6rem] font-[Manrope] font-bold uppercase tracking-wider ${
                        h.tag === "h1" ? "text-[#C96442]" : "text-[#A8A29E]"
                      }`}>{h.tag}</span>
                      <span className="truncate">{h.text || "(empty heading)"}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-8 pt-4 border-t border-[#E6E4DD]">
              <p className="text-[0.65rem] text-[#A8A29E] font-[Manrope]">
                {headings.filter(h => h.tag === "h1").length} sections, {headings.filter(h => h.tag === "h2").length} subsections
              </p>
            </div>
          </div>
        </div>
      )}

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
        onInput={(e) => { handleInput(); if (focusMode) updateActiveBlock(); }}
        onDrop={handleDrop}
        onDragOver={(e) => { if (e.dataTransfer.types.includes("text/image-url")) e.preventDefault(); }}
        onKeyDown={handleKeyDown}
        data-testid="editor-content"
        data-placeholder="Start writing your article..."
        className={`editor-contenteditable ${focusMode ? "focus-mode-active" : ""}`}
      />
    </div>
  );
});

export default RichTextEditor;
