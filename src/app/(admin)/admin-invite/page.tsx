import { InviteForm } from "@/components/admin/InviteForm";

export const instant = false;

export default async function AdminInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return <InviteForm token={token} />;
}
