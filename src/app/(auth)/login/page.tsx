import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in · ReserveX" };

export default function LoginPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Welcome back</h1>
      <p className="mb-5 text-sm text-slate-500">Sign in to manage your reservations.</p>
      <AuthForm mode="login" />
    </>
  );
}