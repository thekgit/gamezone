import GamesClient from "./GamesClient";

export const dynamic = "force-dynamic";

export default function GamesPage() {
  return (
    <div className="text-white">
      <h1 className="text-2xl font-bold">Games</h1>
      <p className="text-white/60 text-sm mt-1">Manage games and discounts.</p>

      <GamesClient />
    </div>
  );
}