"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";

type ImportRow = {
  employee_id: string;
  full_name: string;
  phone: string;
  email: string;
};

function onlyDigits10(v: string) {
  return v.replace(/\D/g, "").slice(0, 10);
}

function cleanEmail(v: string) {
  return v.trim().toLowerCase();
}

function guessKey(obj: Record<string, any>, candidates: string[]) {
  const keys = Object.keys(obj).map((k) => k.toLowerCase().trim());
  for (const c of candidates) {
    const idx = keys.indexOf(c.toLowerCase());
    if (idx >= 0) return Object.keys(obj)[idx];
  }
  return null;
}

// ✅ Extract only needed fields from any CSV/XLSX columns
function normalizeRow(raw: Record<string, any>): ImportRow | null {
  const empKey =
    guessKey(raw, ["employee id", "employee_id", "emp id", "emp_id", "eid", "id"]) || "";
  const nameKey =
    guessKey(raw, ["name", "full name", "full_name", "employee name", "employee_name"]) || "";
  const phoneKey =
    guessKey(raw, ["mobile", "mobile number", "mobile_no", "phone", "phone number", "phone_no"]) ||
    "";
  const emailKey = guessKey(raw, ["email", "email id", "email_id", "mail"]) || "";

  const employee_id = String(empKey ? raw[empKey] : "").trim();
  const full_name = String(nameKey ? raw[nameKey] : "").trim();
  const phone = onlyDigits10(String(phoneKey ? raw[phoneKey] : ""));
  const email = cleanEmail(String(emailKey ? raw[emailKey] : ""));

  if (!employee_id || !full_name || !/^\d{10}$/.test(phone) || !email.includes("@")) return null;

  return { employee_id, full_name, phone, email };
}

export default function AparUsersClient() {
  // upload/import state
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [msg, setMsg] = useState("");
  const [importing, setImporting] = useState(false);

  // manual create state
  const [mEmp, setMEmp] = useState("");
  const [mName, setMName] = useState("");
  const [mPhone, setMPhone] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [creating, setCreating] = useState(false);

  const validRows = useMemo(() => rows, [rows]);

  const onPickFile = async (file: File) => {
    setMsg("");
    setRows([]);

    const ext = (file.name.split(".").pop() || "").toLowerCase();

    // ✅ XLSX/XLS
    if (ext === "xlsx" || ext === "xls") {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const first = wb.SheetNames[0];
      const ws = wb.Sheets[first];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });

      const out: ImportRow[] = [];
      for (const r of json) {
        const n = normalizeRow(r);
        if (n) out.push(n);
      }
      setRows(out);
      setMsg(out.length ? `Loaded ${out.length} valid rows.` : "No valid rows found.");
      return;
    }

    // ✅ CSV
    if (ext === "csv") {
      Papa.parse<Record<string, any>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => {
          const out: ImportRow[] = [];
          for (const r of result.data || []) {
            const n = normalizeRow(r as any);
            if (n) out.push(n);
          }
          setRows(out);
          setMsg(out.length ? `Loaded ${out.length} valid rows.` : "No valid rows found.");
        },
        error: () => setMsg("Failed to parse CSV."),
      });
      return;
    }

    setMsg("Unsupported file type. Please upload .csv or .xlsx");
  };

  const importAll = async () => {
    setMsg("");
    if (!validRows.length) {
      setMsg("No valid rows to import.");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/admin/company/apar/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: validRows }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Import failed.");
        return;
      }

      const errCount = Array.isArray(data.errors) ? data.errors.length : 0;

      setMsg(
        `Import done. Auth created: ${data.createdAuth || 0}, already existed: ${
          data.existedAuth || 0
        }. Errors: ${errCount}.`
      );
    } finally {
      setImporting(false);
    }
  };

  const createOne = async () => {
    setMsg("");

    const employee_id = mEmp.trim();
    const full_name = mName.trim();
    const phone = onlyDigits10(mPhone);
    const email = cleanEmail(mEmail);

    if (!employee_id || !full_name || !/^\d{10}$/.test(phone) || !email.includes("@")) {
      setMsg("Please enter valid Employee ID, Name, 10-digit Phone, and Email.");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/admin/company/apar/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_id, full_name, phone, email }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data?.error || "Create failed.");
        return;
      }

      setMsg(
        data?.created_new_auth_user
          ? "User created. Default password: NEW12345"
          : "User already existed in Auth. Kept as-is."
      );

      setMEmp("");
      setMName("");
      setMPhone("");
      setMEmail("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="text-lg font-semibold">APAR Users</div>
      <div className="text-xs text-white/60 mt-1">
        Import CSV/XLSX (Employee ID, Name, Mobile, Email) or create manually. Default password for
        new users: <span className="text-white font-semibold">NEW12345</span>.
      </div>

      {msg && <div className="mt-3 text-sm text-white/80">{msg}</div>}

      {/* IMPORT */}
      <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="font-semibold">1) Import CSV / XLSX</div>
        <div className="text-xs text-white/60 mt-1">
          We will only read Employee ID, Name, Mobile, Email from the file.
        </div>

        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="mt-3 block w-full text-sm"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFile(f);
          }}
        />

        {validRows.length > 0 && (
          <>
            <div className="mt-4 text-sm text-white/70">
              Preview (first 5 rows):
              <div className="mt-2 space-y-2">
                {validRows.slice(0, 5).map((r, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                    <div>
                      <b>{r.employee_id}</b> • {r.full_name}
                    </div>
                    <div className="text-white/60">{r.phone} • {r.email}</div>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={importAll}
              disabled={importing}
              className="mt-4 w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
            >
              {importing ? "Importing..." : `Import ${validRows.length} Users`}
            </button>
          </>
        )}
      </div>

      {/* MANUAL */}
      <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="font-semibold">2) Create User Manually</div>

        <div className="mt-3 grid gap-3">
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Employee ID"
            value={mEmp}
            onChange={(e) => setMEmp(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Full name"
            value={mName}
            onChange={(e) => setMName(e.target.value)}
          />
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Mobile (10 digits)"
            inputMode="numeric"
            maxLength={10}
            value={mPhone}
            onChange={(e) => setMPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
          <input
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 outline-none focus:border-white/30"
            placeholder="Email"
            inputMode="email"
            value={mEmail}
            onChange={(e) => setMEmail(e.target.value)}
          />
        </div>

        <button
          onClick={createOne}
          disabled={creating}
          className="mt-4 w-full rounded-xl py-3 font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40"
        >
          {creating ? "Creating..." : "Create User"}
        </button>
      </div>
    </div>
  );
}