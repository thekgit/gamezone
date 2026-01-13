import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function ensureAuthUser(
  email: string,
  password: string,
  user_metadata: Record<string, any>
) {
  const admin = supabaseAdmin();
  const targetEmail = email.toLowerCase();

  // 1️⃣ Load auth users (first page is enough in admin panels)
  const { data, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 2000,
  });

  if (error) throw new Error(error.message);

  const existing = (data?.users || []).find(
    (u) => (u.email || "").toLowerCase() === targetEmail
  );

  // 2️⃣ If exists → reset password (RESTORES OLD BEHAVIOR)
  if (existing?.id) {
    const { error: updErr } = await admin.auth.admin.updateUserById(
      existing.id,
      {
        password,
        email_confirm: true,
        user_metadata,
      }
    );

    if (updErr) throw new Error(updErr.message);
    return existing.id;
  }

  // 3️⃣ Else → create new auth user
  const { data: created, error: createErr } =
    await admin.auth.admin.createUser({
      email: targetEmail,
      password,
      email_confirm: true,
      user_metadata,
    });

  if (createErr) throw new Error(createErr.message);
  if (!created?.user?.id) throw new Error("Auth user creation failed");

  return created.user.id;
}