"use client";

import { useState } from "react";
import { X, Pencil } from "lucide-react";
import { BankForm } from "@/components/problem-bank/bank-form";

interface EditBankModalProps {
  bank: {
    id: string;
    name: string;
    description: string;
    updatedAt: string;
  };
}

export function EditBankModal({ bank }: EditBankModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border border-slate-200 hover:border-slate-300 text-[#10182b] px-4 py-2.5 rounded-xl font-bold text-[14px] transition-all flex items-center gap-2 shadow-sm"
      >
        <Pencil className="w-4 h-4 text-slate-500" /> Edit Bank Details
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit Bank Details"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Modal Card */}
          <div className="relative bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-[560px] p-8 z-10">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-[#10182b]">Edit Bank Details</h2>
                <p className="text-slate-500 text-[14px] mt-0.5">
                  Update the name and description for this problem bank.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-[#10182b] transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <BankForm
              mode="edit"
              initialValue={{
                id: bank.id,
                name: bank.name,
                description: bank.description,
                updatedAt: bank.updatedAt,
              }}
              successRedirectHref="/organizer/problem-bank"
            />
          </div>
        </div>
      )}
    </>
  );
}
