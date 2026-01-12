"use client";

export default function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-4">
      <input
        className="w-full max-w-xl rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-white placeholder:text-white/40"
        placeholder="Search by name, email, or phone..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}