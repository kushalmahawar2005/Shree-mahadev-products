import { PageHeader, Table } from "@/components/admin/ui";
import { customers } from "@/data/admin";
import { formatMoney } from "@/lib/utils/money";

export const metadata = { title: "Customers" };

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" intro="Sample customers. Real list comes from Shopify." />
      <Table head={["Name", "City", "Phone", "Orders", "Total spent"]}>
        {customers.map((c) => (
          <tr key={c.phone}>
            <td className="font-semibold">{c.name}</td>
            <td>{c.city}</td>
            <td>{c.phone}</td>
            <td>{c.orders}</td>
            <td>{formatMoney(c.spent)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
