import { PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import { discounts } from "@/data/admin";

export const metadata = { title: "Discounts" };

export default function DiscountsPage() {
  return (
    <>
      <PageHeader title="Discounts" intro="Codes customers enter at Shopify checkout. Keep offers sober (AGENTS.md)." />
      <Table head={["Code", "Type", "Value", "Used", "Status"]}>
        {discounts.map((d) => (
          <tr key={d.code}>
            <td className="font-semibold">{d.code}</td>
            <td>{d.type}</td>
            <td>{d.value}</td>
            <td>{d.used}</td>
            <td>
              <StatusBadge tone={d.status === "Active" ? "green" : "gray"}>{d.status}</StatusBadge>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
