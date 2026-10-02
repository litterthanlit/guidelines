"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewBrand() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex w-full max-w-md items-center gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setBusy(true);
        setError(null);
        const res = await fetch("/api/brands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        setBusy(false);
        if (!res.ok) return setError(((await res.json()) as { error: string }).error);
        const { brand } = (await res.json()) as { brand: { slug: string } };
        router.push(`/b/${brand.slug}`);
      }}
    >
      <label htmlFor="new-brand" className="sr-only">
        Brand name
      </label>
      <input id="new-brand" className="field h-10 rounded-full! px-4!" placeholder="New brand name…" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn btn-primary h-10! px-5!" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
