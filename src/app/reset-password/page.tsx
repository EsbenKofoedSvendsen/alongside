import { ResetForm } from "./ResetForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="app-shell px-7 py-10">
      <h1 className="font-display pt-4 text-[28px] leading-tight">Choose a new password</h1>
      <p className="mb-7 mt-2 text-[15px] text-ink-soft">Make it at least 8 characters.</p>
      <ResetForm token={token ?? ""} />
    </div>
  );
}
