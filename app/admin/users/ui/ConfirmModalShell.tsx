"use client";

export default function ConfirmModalShell({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 text-white relative">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg px-2 py-1 text-white/70 hover:text-white"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="text-lg font-bold">{title}</div>
        {description ? <div className="mt-2 text-sm text-white/70">{description}</div> : null}

        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}