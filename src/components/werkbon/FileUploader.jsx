import React, { useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Upload, X, FileText, Image, Loader2 } from 'lucide-react';

export default function FileUploader({ label, files = [], onChange, accept = "*/*", icon: Icon = Upload }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;
    setUploading(true);
    const newUrls = [];
    for (const file of selectedFiles) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      newUrls.push(file_url);
    }
    onChange([...files, ...newUrls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const removeFile = (index) => {
    onChange(files.filter((_, i) => i !== index));
  };

  const isImage = (url) => /\.(jpg|jpeg|png|gif|webp)/i.test(url);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <input ref={inputRef} type="file" multiple accept={accept} onChange={handleUpload} className="hidden" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full border-dashed border-2 h-12 text-slate-500"
      >
        {uploading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Uploaden...</>
        ) : (
          <><Icon className="w-4 h-4 mr-2" />Bestanden kiezen</>
        )}
      </Button>
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {files.map((url, i) => (
            <div key={i} className="relative group rounded-lg overflow-hidden border border-slate-200">
              {isImage(url) ? (
                <img src={url} alt="" className="w-full h-20 object-cover" />
              ) : (
                <div className="w-full h-20 bg-slate-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-slate-400" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute top-1 right-1 bg-white/90 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              >
                <X className="w-3 h-3 text-slate-600" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}