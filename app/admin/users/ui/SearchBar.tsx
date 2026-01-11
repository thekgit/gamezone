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
        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30 text-white"
        placeholder="Search by name, email, or phone..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}