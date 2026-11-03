import { PageHeader, StatusBadge, Table } from "@/components/admin/ui";
import { reviews } from "@/data/admin";

export const metadata = { title: "Reviews" };

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Reviews" intro="Only real, verified reviews go live. Judge.me will feed this later." />
      <Table head={["Product", "Customer", "Rating", "Review", "Verified", "Status"]}>
        {reviews.map((r) => (
          <tr key={r.id}>
            <td className="font-semibold">{r.product}</td>
            <td>{r.name}</td>
            <td className="whitespace-nowrap text-mustard">{"★".repeat(r.rating)}<span className="text-black/20">{"★".repeat(5 - r.rating)}</span></td>
            <td className="max-w-xs text-sm">{r.text}</td>
            <td>{r.verified ? "Yes" : "No"}</td>
            <td>
              <StatusBadge tone={r.status === "Published" ? "green" : "amber"}>{r.status}</StatusBadge>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
