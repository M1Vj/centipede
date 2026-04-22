"use client";

import { useState } from "react";
import { X, FileUp } from "lucide-react";
import { ImportControls } from "@/components/problem-bank/import-controls";

interface ImportCsvModalProps {
  bankId: string;
}

export function ImportCsvModal({ bankId }: ImportCsvModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
      >
        <FileUp className="w-4 h-4 text-slate-500" /> Import CSV
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Import CSV"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal Card */}
          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-[600px] p-8 z-10 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#10182b]">Import CSV</h2>
                  <p className="text-slate-500 text-[14px] mt-0.5">
                    Download the template, populate rows, and upload.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-[#10182b] transition-colors shrink-0 ml-4"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ImportControls bankId={bankId} />
          </div>
        </div>
      )}
    </>
  );
}
