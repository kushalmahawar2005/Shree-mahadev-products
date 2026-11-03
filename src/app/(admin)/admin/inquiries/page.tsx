import { PageHeader, StatusBadge, Table, statusTone } from "@/components/admin/ui";
import { inquiries } from "@/data/admin";

export const metadata = { title: "Bulk inquiries" };

export default function InquiriesPage() {
  return (
    <>
      <PageHeader title="Bulk inquiries" intro="From the Bulk orders form (restaurants, stores). Today the form opens WhatsApp; later it can also land here." />
      <Table head={["ID", "Date", "Contact", "Business", "Product", "Qty", "Status"]}>
        {inquiries.map((i) => (
          <tr key={i.id}>
            <td className="font-semibold">{i.id}</td>
            <td>{i.date}</td>
            <td>{i.name}</td>
            <td>
              {i.business}
              <span className="block text-sm text-ink-muted">{i.city}</span>
            </td>
            <td>{i.product}</td>
            <td>{i.qty}</td>
            <td>
              <StatusBadge tone={statusTone(i.status) as "green"}>{i.status}</StatusBadge>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
