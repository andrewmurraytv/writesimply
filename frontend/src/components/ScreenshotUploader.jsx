import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, X, GripVertical, Pencil, Check } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ScreenshotUploader({ screenshots = [], onUploaded, onRemove, onRename, draggable = false }) {
  const { apiFetch } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Only images allowed");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiFetch(`${API}/upload`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        const baseName = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
        onUploaded({ path: data.path, name: baseName });
        toast.success("Screenshot uploaded");
      } else {
        toast.error("Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadFile(files[0]);
  };

  const handleDragStart = (e, shot) => {
    const imgUrl = `${API}/files/${shot.path}`;
    e.dataTransfer.setData("text/image-url", imgUrl);
    e.dataTransfer.setData("text/image-name", shot.name || "Screenshot");
    e.dataTransfer.effectAllowed = "copy";
  };

  const startRename = (i) => {
    setEditingIndex(i);
    setEditName(screenshots[i]?.name || "");
  };

  const commitRename = (i) => {
    if (onRename) onRename(i, editName.trim());
    setEditingIndex(null);
    setEditName("");
  };

  return (
    <div>
      {screenshots.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" data-testid="screenshot-thumbnails">
          {screenshots.map((shot, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`relative group ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                draggable={draggable}
                onDragStart={draggable ? (e) => handleDragStart(e, shot) : undefined}
                data-testid={`screenshot-${i}`}
              >
                {draggable && (
                  <div className="absolute top-0.5 left-0.5 bg-black/40 rounded-sm p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <GripVertical className="w-3 h-3 text-white" />
                  </div>
                )}
                <img
                  src={`${API}/files/${shot.path}`}
                  alt={shot.name || `Screenshot ${i + 1}`}
                  className="screenshot-thumb"
                  crossOrigin="anonymous"
                />
                <button
                  onClick={() => onRemove(i)}
                  data-testid={`remove-screenshot-${i}`}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#991B1B] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              {/* Editable name */}
              {editingIndex === i ? (
                <div className="flex items-center gap-0.5">
                  <input
                    autoFocus
                    data-testid={`rename-input-${i}`}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(i); if (e.key === "Escape") setEditingIndex(null); }}
                    onBlur={() => commitRename(i)}
                    className="w-[72px] text-[0.6rem] px-1 py-0.5 border border-[#E6E4DD] rounded-sm font-[Manrope] focus:outline-none focus:ring-1 focus:ring-[#1F1E1D] bg-white text-center"
                  />
                </div>
              ) : (
                <button
                  onClick={() => startRename(i)}
                  data-testid={`rename-btn-${i}`}
                  className="flex items-center gap-0.5 text-[0.6rem] text-[#78716C] hover:text-[#1F1E1D] font-[Manrope] max-w-[80px] truncate transition-colors"
                  title="Click to rename"
                >
                  <span className="truncate">{shot.name || "Untitled"}</span>
                  <Pencil className="w-2 h-2 shrink-0 opacity-0 group-hover:opacity-100" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div
        data-testid="screenshot-upload-zone"
        className={`upload-zone ${dragging ? "dragging" : ""}`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <Upload className="w-5 h-5 text-[#A8A29E] mx-auto mb-1.5" strokeWidth={1.5} />
        <p className="text-xs text-[#78716C]">
          {uploading ? "Uploading..." : "Drop image or click to upload"}
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => { if (e.target.files?.[0]) uploadFile(e.target.files[0]); e.target.value = ""; }}
        className="hidden"
        data-testid="screenshot-file-input"
      />
    </div>
  );
}
