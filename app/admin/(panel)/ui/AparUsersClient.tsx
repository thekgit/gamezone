"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

type ParsedRow = {
  employee_id: string;
  full_name: string;
  phone: string;
  email: string;
};

function normEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}
function normPhone(v: any) {
  return String(v || "").replace(/\D/g, "").slice(0, 10);
}

function pickCol(obj: Record<string, any>, keys: string[]) {
  const lower: Record<string, string> = {};
  Object.keys(obj).forEach((k) => (lower[k.toLowerCase().trim()] = k));
  for (const want of keys) {
    const k = lower[want.toLowerCase().trim()];
    if (k) return obj[k];
  }
  return "";
}

// ✅ map sheet headers to your needed fields
function mapAnyRowToParsed(obj: Record<string, any>): ParsedRow | null {
  const employee_id = String(
    pickCol(obj, [
      "employee id",
      "employee_id",
      "emp id",
      "empid",
      "id",
      "employeeid",
      "employee code",
      "employee no",
    ])
  ).trim();

  const full_name = String(pickCol(obj, ["name", "full name", "full_name", "employee name"])).trim();

  const phone = normPhone(
    pickCol(obj, ["mobile no.", "mobile", "mobile number", "phone", "phone no", "phone number"])
  );

  const email = normEmail(pickCol(obj, ["e-mail", "email", "mail", "email id", "emailid"]));

  if (!email || !employee_id) return null;

  return {
    employee_id,
    full_name,
    phone,
    email,
  };
}

export default function AparUsersClient() {
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // progress
  const [importing, setImporting] = useState(false);
  const [progressText, setProgressText] = useState("");
  const [progressPct, setProgressPct] = useState(0);

  const cancelRef = useRef(false);

  // manual create form
  const [empId, setEmpId] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const canManual = empId.trim() && email.trim();
  const previewCount = parsed.length;

  const parseFile = async (file: File) => {
    setMsg("");
    setParsed([]);
    setProgressText("");
    setProgressPct(0);
    cancelRef.current = false;

    const ext = file.name.toLowerCase().split(".").pop();

    try {
      if (ext === "csv") {
        const text = await file.text();
        const res = Papa.parse<Record<string, any>>(text, {
          header: true,
          skipEmptyLines: true,
        });

        const rows = (res.data || [])
          .map(mapAnyRowToParsed)
          .filter(Boolean) as ParsedRow[];

        setParsed(rows);
        setMsg(`✅ Parsed ${rows.length} valid rows from CSV.`);
        return;
      }

      // xlsx/xls
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      const rows = (json || []).map(mapAnyRowToParsed).filter(Boolean) as ParsedRow[];
      setParsed(rows);
      setMsg(`✅ Parsed ${rows.length} valid rows from Excel.`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to parse file");
    }
  };

  // ✅ Chunked import (50 rows each) + progress + cancel
  const importUsers = async () => {
    setMsg("");
    if (parsed.length === 0) {
      setMsg("No valid rows found. Need at least Employee ID + Email.");
      return;
    }

    cancelRef.current = false;
    setBusy(true);
    setImporting(true);
    setProgressPct(0);

    const CHUNK = 50;

    let totalImported = 0;
    let totalCreated = 0;
    let totalExisting = 0;
    let totalInvalid = 0;
    let totalAuthFailed = 0;

    try {
      for (let i = 0; i < parsed.length; i += CHUNK) {
        if (cancelRef.current) {
          setMsg("⚠️ Import cancelled.");
          return;
        }

        const chunk = parsed.slice(i, i + CHUNK);

        const done = Math.min(i + CHUNK, parsed.length);
        const pct = Math.round((done / parsed.length) * 100);

        setProgressText(`Uploading ${done} / ${parsed.length} ...`);
        setProgressPct(pct);

        const res = await fetch("/api/admin/company/apar/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMsg(data?.error || `Import failed (${res.status})`);
          return;
        }

        totalImported += Number(data?.imported || 0);
        totalCreated += Number(data?.created_auth || 0);
        totalExisting += Number(data?.existing_kept || 0);
        totalInvalid += Number(data?.invalid || 0);
        totalAuthFailed += Number(data?.auth_failed || 0);
      }

      setMsg(
        [
          "✅ Import complete",
          `• Employees saved: ${totalImported}`,
          `• New auth created: ${totalCreated}`,
          `• Existing kept: ${totalExisting}`,
          `• Invalid rows: ${totalInvalid}`,
          `• Auth failed: ${totalAuthFailed}`,
        ].join("\n")
      );

      setParsed([]);
    } finally {
      setBusy(false);
      setImporting(false);
      setProgressText("");
      setProgressPct(0);
      cancelRef.current = false;
    }
  };

  const createManual = async () => {
    setMsg("");
    const cleanEmail = normEmail(email);
    if (!cleanEmail) {
      setMsg("Email is required");
      return;
    }

    const body: ParsedRow = {
      employee_id: empId.trim(),
      full_name: fullName.trim(),
      phone: normPhone(phone),
      email: cleanEmail,
    };

    setBusy(true);
    try {
      const res = await fetch("/api/admin/company/apar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Create failed");
        return;
      }

      setMsg(
        "✅ Done. If NEW user → default password: NEW12345. If user already existed → kept as-is (password not reset)."
      );

      setEmpId("");
      setFullName("");
      setPhone("");
      setEmail("");
    } finally {
      setBusy(false);
    }
  };

  const msgLines = useMemo(() => String(msg || "").split("\n").filter(Boolean), [msg]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">APAR Users</div>
          <div className="text-white/60 text-sm">
            Import CSV/XLSX (Employee ID, Name, Mobile, Email) OR create manually.
          </div>
        </div>
      </div>

      {msgLines.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-yellow-200 whitespace-pre-line">
          {msgLines.join("\n")}
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {/* IMPORT */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="font-semibold">1) Import CSV/XLSX</div>
          <div className="text-white/60 text-xs mt-1">
            First sheet will be used. Only Employee ID + Email are mandatory.
          </div>

          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="mt-3 block w-full text-sm text-white/80"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) parseFile(f);
            }}
            disabled={busy}
          />

          <div className="mt-3 text-sm text-white/70">
            Preview rows found: <span className="text-white font-semibold">{previewCount}</span>
          </div>

          {importing && (
            <div className="mt-3">
              <div className="text-xs text-white/70">{progressText || "Importing..."}</div>
              <div className="mt-2 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-white/50">{progressPct}%</div>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={importUsers}
              disabled={busy || parsed.length === 0}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 font-semibold hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy ? "Working..." : "Import Users"}
            </button>

            <button
              onClick={() => {
                cancelRef.current = true;
                setMsg("⚠️ Cancelling import...");
              }}
              disabled={!importing}
              className="rounded-xl bg-white/10 px-4 py-2.5 font-semibold hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>

          <div className="mt-2 text-xs text-white/50">
            Tip: Large files are uploaded in batches automatically (50 rows each).
          </div>
        </div>

        {/* MANUAL CREATE */}
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="font-semibold">2) Manual Create</div>
          <div className="text-white/60 text-xs mt-1">
            Default password for NEW users: <span className="text-white">NEW12345</span>
          </div>

          <div className="mt-3 grid gap-2">
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
              placeholder="Employee ID (required)"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              disabled={busy}
            />
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={busy}
            />
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
              placeholder="Phone (10 digits)"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              disabled={busy}
            />
            <input
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 outline-none"
              placeholder="Email (required)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
            />
          </div>

          <button
            onClick={createManual}
            disabled={busy || !canManual}
            className="mt-3 w-full rounded-xl bg-white text-black py-2.5 font-semibold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "Working..." : "Create User"}
          </button>
        </div>
      </div>
    </div>
  );
}