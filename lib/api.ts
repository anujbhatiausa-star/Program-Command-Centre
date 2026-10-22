import "server-only";
import { NextResponse } from "next/server";

export const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Database errors (RLS, workflow trigger) come back as readable messages. */
export const dbFail = (e: { message: string }) =>
  fail(e.message.replace(/^.*?ERROR:\s*/, ""), /row-level security|Only /.test(e.message) ? 403 : 409);
