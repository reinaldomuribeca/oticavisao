import { isAdminAuthed } from "@/lib/admin-auth";
import { AdminLogin } from "./AdminLogin";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default function AdminPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  if (!isAdminAuthed()) {
    return <AdminLogin nextPath={searchParams.next} />;
  }
  return <Dashboard />;
}
