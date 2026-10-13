import { AdminTabs } from "@/components/admin/AdminTabs";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Admin</h1>
      <AdminTabs />
      {children}
    </div>
  );
}