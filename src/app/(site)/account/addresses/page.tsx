import { connection } from "next/server";
import { AddressesGrid } from "@/components/account/addresses/AddressesGrid";
import { PageHeader } from "@/components/account/ui";
import { accountConfig } from "@/config/account";
import { getAccountShell } from "@/lib/server/account";
import { listAddresses } from "@/lib/server/account-addresses";

export const metadata = { title: "Addresses", robots: { index: false } };
// Per-session data: render per request (the layout opt-out does not cover sibling pages).
export const instant = false;

export default async function AddressesPage() {
  await connection();
  const shell = await getAccountShell();
  if (!shell) return null; // layout redirects
  const addresses = await listAddresses(shell.customer.id);

  return (
    <>
      <PageHeader
        eyebrow="मेरे पते"
        title="Addresses"
        subtitle="Save where you want orders delivered. Your default is filled in at checkout."
      />
      <AddressesGrid addresses={addresses} max={accountConfig.maxAddresses} />
    </>
  );
}
