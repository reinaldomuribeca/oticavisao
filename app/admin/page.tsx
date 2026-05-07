import { isAdminAuthed } from "@/lib/admin-auth";
import { AdminLogin } from "./AdminLogin";
import { Dashboard } from "./Dashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  if (!(await isAdminAuthed())) {
    return <AdminLogin nextPath={searchParams.next} />;
  }
  return <Dashboard />;
}
