import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ScreenshotUploader({ screenshots = [], onUploaded, onRemove }) {
  const { apiFetch } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
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
        onUploaded(data.path);
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

  return (
    <div>
      {/* Thumbnails */}
      {screenshots.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3" data-testid="screenshot-thumbnails">
          {screenshots.map((path, i) => (
            <div key={i} className="relative group" data-testid={`screenshot-${i}`}>
              <img
                src={`${API}/files/${path}`}
                alt={`Screenshot ${i + 1}`}
                className="screenshot-thumb"
                crossOrigin="use-credentials"
              />
              <button
                onClick={() => onRemove(i)}
                data-testid={`remove-screenshot-${i}`}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#991B1B] text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone */}
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
