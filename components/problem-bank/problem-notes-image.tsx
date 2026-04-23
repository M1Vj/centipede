import { FileText, ImageIcon, UploadCloud } from "lucide-react";
import React, { useRef } from "react";

interface ProblemNotesImageProps {
  authoringNotes: string;
  onAuthoringNotesChange: (notes: string) => void;
  imageUrl: string | null;
  onUploadImage: (file: File | null) => Promise<void>;
  isUploadingAsset: boolean;
}

export function ProblemNotesImage({
  authoringNotes,
  onAuthoringNotesChange,
  imageUrl,
  onUploadImage,
  isUploadingAsset,
}: ProblemNotesImageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    if (!isUploadingAsset) {
      fileInputRef.current?.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    await onUploadImage(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full font-['Poppins',sans-serif]">
      {/* Authoring Notes */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm h-[260px] flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#f49700]/10 flex items-center justify-center text-[#f49700]">
            <FileText className="w-5 h-5" />
          </div>
          <h2 className="text-[16px] font-bold text-[#10182b]">Authoring Notes</h2>
        </div>
        <textarea
          value={authoringNotes}
          onChange={(e) => onAuthoringNotesChange(e.target.value)}
          placeholder="Internal notes for review or future reference.."
          className="w-full flex-1 bg-slate-50 border border-slate-200 text-[#10182b] rounded-2xl p-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#f49700] focus:border-transparent transition-all placeholder:text-slate-400 font-medium resize-none"
        ></textarea>
      </div>

      {/* Problem Image */}
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm h-[260px] flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-[#f49700]/10 flex items-center justify-center text-[#f49700]">
            <ImageIcon className="w-5 h-5" />
          </div>
          <h2 className="text-[16px] font-bold text-[#10182b]">Problem Image</h2>
        </div>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
          disabled={isUploadingAsset}
        />

        <div
          onClick={handleImageClick}
          className="flex-1 w-full border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 hover:border-[#f49700]/50 transition-all flex flex-col items-center justify-center cursor-pointer group relative overflow-hidden"
        >
          {isUploadingAsset ? (
            <p className="text-[#10182b] font-bold text-[14px]">Uploading...</p>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Problem Asset" className="object-contain w-full h-full p-2" />
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <UploadCloud className="w-6 h-6 text-[#f49700]" />
              </div>
              <p className="text-[#10182b] font-bold text-[14px] mb-1">Click to upload image</p>
              <p className="text-slate-400 text-[12px] font-medium">PNG, JPG or SVG (Max 10MB)</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
