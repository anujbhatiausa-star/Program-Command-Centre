"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function browserClient() {
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
