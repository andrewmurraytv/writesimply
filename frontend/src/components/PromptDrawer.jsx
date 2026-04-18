import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, Save } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PromptDrawer({ open, onOpenChange }) {
  const { apiFetch } = useAuth();
  const [prompts, setPrompts] = useState([]);
  const [editedContent, setEditedContent] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    if (open) loadPrompts();
  }, [open]);

  const loadPrompts = async () => {
    try {
      const res = await apiFetch(`${API}/prompts`);
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
        const edits = {};
        data.forEach((p) => { edits[p.id] = p.content; });
        setEditedContent(edits);
      }
    } catch {
      toast.error("Failed to load prompts");
    }
  };

  const savePrompt = async (promptId) => {
    setSavingId(promptId);
    try {
      const res = await apiFetch(`${API}/prompts/${promptId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editedContent[promptId] }),
      });
      if (res.ok) toast.success("Prompt saved");
    } catch {
      toast.error("Failed to save prompt");
    } finally {
      setSavingId(null);
    }
  };

  const copyToClipboard = async (promptId) => {
    try {
      await navigator.clipboard.writeText(editedContent[promptId] || "");
      setCopiedId(promptId);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl bg-[#FAF9F5] border-l border-[#E6E4DD] shadow-2xl p-0 overflow-y-auto" data-testid="prompt-drawer">
        <div className="p-6">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold text-[#1F1E1D] font-[Manrope]">Prompt Templates</SheetTitle>
            <SheetDescription className="text-sm text-[#78716C] font-[Manrope]">
              Edit your prompt templates, copy them, and paste into your Gemini gem.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-8">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="space-y-3" data-testid={`prompt-template-${prompt.id}`}>
                <h3 className="text-sm font-bold text-[#1F1E1D] font-[Manrope]">{prompt.name}</h3>
                <textarea
                  data-testid={`prompt-textarea-${prompt.id}`}
                  value={editedContent[prompt.id] || ""}
                  onChange={(e) => setEditedContent({ ...editedContent, [prompt.id]: e.target.value })}
                  rows={10}
                  className="w-full text-sm px-4 py-3 bg-white border border-[#E6E4DD] rounded-md font-[Manrope] text-[#4A4541] leading-relaxed focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] resize-y"
                />
                <div className="flex gap-2">
                  <Button
                    data-testid={`copy-prompt-${prompt.id}`}
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(prompt.id)}
                    className="border-[#E6E4DD] font-[Manrope] text-xs text-[#1F1E1D]"
                  >
                    {copiedId === prompt.id ? <Check className="w-3.5 h-3.5 mr-1.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />}
                    {copiedId === prompt.id ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    data-testid={`save-prompt-${prompt.id}`}
                    size="sm"
                    onClick={() => savePrompt(prompt.id)}
                    disabled={savingId === prompt.id}
                    className="bg-[#1F1E1D] text-[#FAF9F5] hover:bg-[#1F1E1D]/90 font-[Manrope] text-xs"
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                    {savingId === prompt.id ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
