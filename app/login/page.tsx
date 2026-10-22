import { CustomerMark, SampleDataBadge, Wordmark } from "@/components/Brand";
import { LoginForm } from "@/components/LoginForm";
import { isConfigured } from "@/lib/supabase/env";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Wordmark />
          <SampleDataBadge />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Program Command Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Salesforce delivery program for <CustomerMark />
          </p>
          {isConfigured ? (
            <LoginForm />
          ) : (
            <div role="alert" className="mt-5 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Supabase is not configured. Copy <code>.env.example</code> to <code>.env.local</code>, fill in your
              project URL and keys, then restart <code>npm run dev</code>. See the README.
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Demo only. All people, stories and figures are fictional sample data.
        </p>
      </div>
    </main>
  );
}
