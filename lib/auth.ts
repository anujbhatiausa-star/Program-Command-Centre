import "server-only";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { createClient } from "./supabase/server";
import { canOpen, homeFor, type Role } from "./roles";

export interface Viewer {
  userId: string;
  email: string;
  role: Role;
  org: "algoworks" | "customer";
  personId: string | null;
}

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("role, org, person_id, email")
    .eq("user_id", user.id)
    .single();
  if (!data) return null;
  return { userId: user.id, email: data.email, role: data.role, org: data.org, personId: data.person_id };
}

/** For pages: signed in and allowed to open `href`, otherwise redirect. */
export async function requirePage(href: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  if (!canOpen(viewer.role, href)) redirect(homeFor(viewer.role));
  return viewer;
}

/** For route handlers: returns the viewer, or a 401/403 response. */
export async function requireRole(roles: Role[]): Promise<Viewer | NextResponse> {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!roles.includes(viewer.role)) {
    return NextResponse.json({ error: "Your role is not allowed to do this" }, { status: 403 });
  }
  return viewer;
}
