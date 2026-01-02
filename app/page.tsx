import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">
          Welcome to the Game Zone 🎮
        </h1>

        <p className="text-white/60 mb-8">
          Book your slots, play games, and enjoy your time.
        </p>

        <Link
          href="/login"
          className="inline-block rounded-xl bg-white text-black px-8 py-3 font-semibold hover:bg-white/90 transition"
        >
          Login
        </Link>
      </div>
    </main>
  );
}