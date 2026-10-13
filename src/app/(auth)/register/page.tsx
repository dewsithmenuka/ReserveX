import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Register · ReserveX" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Create your account</h1>
      <p className="mb-5 text-sm text-slate-500">Book shared rooms and equipment in seconds.</p>
      <AuthForm mode="register" />
    </>
  );
}