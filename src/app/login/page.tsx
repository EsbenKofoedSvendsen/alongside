import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="app-shell px-7 py-10">
      <div className="pt-4">
        <div className="mb-4 text-4xl">🤝</div>
        <h1 className="font-display text-[28px] leading-tight">Welcome back</h1>
        <p className="mb-7 mt-2 text-[15px] text-ink-soft">Log in to continue caring, confidently.</p>
      </div>
      <LoginForm />
      <div className="mt-8 rounded-2xl bg-moss-soft p-4 text-[13px] leading-relaxed text-moss">
        <p className="font-semibold">Pilot demo accounts</p>
        <p className="mt-1">
          Caregiver: <code>siti@example.com</code> / <code>alongside-demo</code>
        </p>
        <p>
          Ops team: <code>ops@alongside.app</code> / <code>alongside-ops</code>
        </p>
        <p className="mt-1">
          Fresh caregiver flow: open <code>/invite/demo-invite-token</code>
        </p>
      </div>
    </div>
  );
}
