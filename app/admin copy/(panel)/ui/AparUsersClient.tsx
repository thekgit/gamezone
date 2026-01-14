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

function normalizeKey(k: string) {
  return k
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ""); // remove spaces, dots, hyphens
}

function pickCol(obj: Record<string, any>, keys: string[]) {
  const normMap: Record<string, string> = {};

  Object.keys(obj).forEach((k) => {
    normMap[normalizeKey(k)] = k;
  });

  for (const want of keys) {
    const nk = normalizeKey(want);
    if (normMap[nk]) return obj[normMap[nk]];
  }
  return "";
}

// ✅ map sheet headers to your needed fields
function mapAnyRowToParsed(obj: Record<string, any>): ParsedRow | null {
  const employee_id = String(
    pickCol(obj, [
      "employee id",
      "employeeid",
      "emp id",
      "empid",
      "employee code",
      "emp code",
      "code",
    ])
  ).trim();

  const full_name = String(
    pickCol(obj, ["name", "full name", "employee name"])
  ).trim();

  const phone = normPhone(
    pickCol(obj, [
      "mobile no",
      "mobile",
      "mobile number",
      "phone",
      "phone no",
      "contact",
    ])
  );

  const email = normEmail(
    pickCol(obj, [
      "email",
      "e-mail",
      "email id",
      "mail",
      "email address",
    ])
  );

  if (!email || !employee_id) return null;

  return { employee_id, full_name, phone, email };
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
  
    // header detection helper
    const looksLikeHeader = (cells: any[]) => {
      const joined = cells.map((c) => String(c ?? "")).join(" ").toLowerCase();
      // must include at least employee + email (and usually name/mobile)
      return (
        joined.includes("employee") &&
        (joined.includes("email") || joined.includes("e-mail")) &&
        (joined.includes("mobile") || joined.includes("phone") || joined.includes("contact") || joined.includes("no"))
      );
    };
  
    const buildObjectsFromRows = (rows: any[][], headerIdx: number) => {
      const headers = rows[headerIdx].map((h) => String(h ?? "").trim());
      const dataRows = rows.slice(headerIdx + 1);
  
      const objs: Record<string, any>[] = dataRows
        .filter((r) => r && r.length > 0)
        .map((r) => {
          const obj: Record<string, any> = {};
          for (let i = 0; i < headers.length; i++) {
            const key = headers[i] || `col_${i}`;
            obj[key] = r[i] ?? "";
          }
          return obj;
        });
  
      return objs;
    };
  
    try {
      // =========================
      // ✅ CSV: parse as raw rows, find header row, rebuild objects
      // =========================
      if (ext === "csv") {
        const text = await file.text();
  
        const res = Papa.parse<any[]>(text, {
          header: false,           // IMPORTANT: raw rows
          skipEmptyLines: true,
        });
  
        const rows = (res.data || []) as any[][];
        if (!rows.length) {
          setMsg("CSV is empty.");
          return;
        }
  
        // find header row
        let headerIdx = -1;
        for (let i = 0; i < Math.min(rows.length, 30); i++) {
          if (looksLikeHeader(rows[i])) {
            headerIdx = i;
            break;
          }
        }
  
        if (headerIdx === -1) {
          setMsg(
            "Could not detect header row in CSV. Make sure file contains columns like Employee Id, Name, Mobile No., E-Mail."
          );
          return;
        }
  
        const objs = buildObjectsFromRows(rows, headerIdx);
  
        const parsedRows = objs.map(mapAnyRowToParsed).filter(Boolean) as ParsedRow[];
        setParsed(parsedRows);
  
        setMsg(`✅ Parsed ${parsedRows.length} valid rows from CSV (header row detected at line ${headerIdx + 1}).`);
        return;
      }
  
      // =========================
      // ✅ XLSX/XLS: read as 2D rows, find header row, rebuild objects
      // =========================
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
  
      // read as raw rows
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" }) as any[][];
  
      if (!rows.length) {
        setMsg("Sheet is empty.");
        return;
      }
  
      // find header row
      let headerIdx = -1;
      for (let i = 0; i < Math.min(rows.length, 30); i++) {
        if (looksLikeHeader(rows[i])) {
          headerIdx = i;
          break;
        }
      }
  
      if (headerIdx === -1) {
        setMsg(
          "Could not detect header row in XLSX. Make sure sheet has columns like Employee Id, Name, Mobile No., E-Mail."
        );
        return;
      }
  
      const objs = buildObjectsFromRows(rows, headerIdx);
      const parsedRows = objs.map(mapAnyRowToParsed).filter(Boolean) as ParsedRow[];
  
      setParsed(parsedRows);
      setMsg(`✅ Parsed ${parsedRows.length} valid rows from XLSX (header row detected at row ${headerIdx + 1}).`);
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