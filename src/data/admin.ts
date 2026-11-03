/**
 * MOCK admin data. Replace with Shopify Admin API / real store data step by step.
 * TODO(client): real orders come from Shopify; inquiries from the bulk form; customers from Shopify.
 */
export type OrderStatus = "Paid" | "COD" | "Shipped" | "Delivered" | "Cancelled";

export type AdminOrder = {
  id: string;
  date: string;
  customer: string;
  city: string;
  items: { handle: string; title: string; size: string; qty: number }[];
  total: number;
  status: OrderStatus;
  payment: "UPI" | "Card" | "COD";
};

export const orders: AdminOrder[] = [
  { id: "#1042", date: "03 Nov", customer: "Ramesh Sharma", city: "Jaipur", items: [{ handle: "yellow-mustard-oil", title: "Yellow Mustard Oil", size: "1 L", qty: 2 }], total: 1144, status: "Paid", payment: "UPI" },
  { id: "#1041", date: "03 Nov", customer: "Sunita Verma", city: "Ajmer", items: [{ handle: "groundnut-oil", title: "Groundnut Oil", size: "2 L", qty: 1 }, { handle: "jamun-raw-honey", title: "Jamun Raw Honey", size: "250 g", qty: 1 }], total: 1242, status: "COD", payment: "COD" },
  { id: "#1040", date: "02 Nov", customer: "Anil Gupta", city: "Delhi", items: [{ handle: "yellow-mustard-oil", title: "Yellow Mustard Oil", size: "15 L", qty: 1 }], total: 7133, status: "Shipped", payment: "Card" },
  { id: "#1039", date: "02 Nov", customer: "Pooja Mehta", city: "Mumbai", items: [{ handle: "almond-oil", title: "Almond Oil", size: "50 ml", qty: 2 }], total: 636, status: "Shipped", payment: "UPI" },
  { id: "#1038", date: "01 Nov", customer: "Deepak Joshi", city: "Beawar", items: [{ handle: "flaxseed-oil", title: "Flaxseed Oil", size: "500 ml", qty: 1 }], total: 545, status: "Delivered", payment: "UPI" },
  { id: "#1037", date: "01 Nov", customer: "Kavita Singh", city: "Udaipur", items: [{ handle: "black-sesame-oil", title: "Black Sesame Oil", size: "250 ml", qty: 3 }], total: 1149, status: "Delivered", payment: "UPI" },
  { id: "#1036", date: "31 Oct", customer: "Mohit Agarwal", city: "Kota", items: [{ handle: "groundnut-oil", title: "Groundnut Oil", size: "5 L", qty: 1 }], total: 2250, status: "Delivered", payment: "Card" },
  { id: "#1035", date: "31 Oct", customer: "Neha Rathore", city: "Jodhpur", items: [{ handle: "jamun-raw-honey", title: "Jamun Raw Honey", size: "500 g", qty: 2 }], total: 980, status: "Cancelled", payment: "UPI" },
];

export type AdminCustomer = { name: string; city: string; phone: string; orders: number; spent: number };
export const customers: AdminCustomer[] = [
  { name: "Anil Gupta", city: "Delhi", phone: "+91 98xxxxxx01", orders: 5, spent: 21480 },
  { name: "Mohit Agarwal", city: "Kota", phone: "+91 98xxxxxx02", orders: 3, spent: 6120 },
  { name: "Kavita Singh", city: "Udaipur", phone: "+91 97xxxxxx03", orders: 3, spent: 3890 },
  { name: "Ramesh Sharma", city: "Jaipur", phone: "+91 98xxxxxx04", orders: 2, spent: 2210 },
  { name: "Sunita Verma", city: "Ajmer", phone: "+91 90xxxxxx05", orders: 2, spent: 2104 },
  { name: "Pooja Mehta", city: "Mumbai", phone: "+91 99xxxxxx06", orders: 1, spent: 636 },
];

export type Inquiry = { id: string; date: string; name: string; business: string; city: string; product: string; qty: string; status: "New" | "Contacted" | "Closed" };
export const inquiries: Inquiry[] = [
  { id: "B-12", date: "03 Nov", name: "Rakesh Jain", business: "Jain Sweets", city: "Kishangarh", product: "Groundnut Oil 15 L", qty: "20 tins", status: "New" },
  { id: "B-11", date: "02 Nov", name: "Hotel Rajdoot", business: "Rajdoot Restaurant", city: "Ajmer", product: "Yellow Mustard Oil 15 L", qty: "10 tins", status: "Contacted" },
  { id: "B-10", date: "30 Oct", name: "Vikas Traders", business: "Vikas Kirana", city: "Beawar", product: "Mixed oils 5 L", qty: "40 tins", status: "Closed" },
];

/** Deterministic fake stock so the UI looks real. */
export function mockStock(variantId: string) {
  let h = 0;
  for (const c of variantId) h = (h * 31 + c.charCodeAt(0)) % 97;
  return h % 9 === 0 ? 0 : h % 5 === 0 ? 4 : 12 + (h % 60);
}

export const revenueLast7 = [
  { d: "Wed", v: 4200 },
  { d: "Thu", v: 6100 },
  { d: "Fri", v: 3800 },
  { d: "Sat", v: 9200 },
  { d: "Sun", v: 7400 },
  { d: "Mon", v: 5600 },
  { d: "Tue", v: 8100 },
];

export type AbandonedCart = {
  id: string;
  customer: string;
  phone: string; // mock full number, shown masked
  city: string;
  items: { title: string; size: string; qty: number }[];
  value: number;
  ago: string;
  status: "Not contacted" | "WhatsApp sent" | "Recovered";
};

export const abandonedCarts: AbandonedCart[] = [
  { id: "AC-221", customer: "Rohit Saini", phone: "919999000011", city: "Jaipur", items: [{ title: "Yellow Mustard Oil", size: "5 L", qty: 1 }], value: 2525, ago: "35 min ago", status: "Not contacted" },
  { id: "AC-220", customer: "Meena Kumari", phone: "919999000012", city: "Beawar", items: [{ title: "Groundnut Oil", size: "2 L", qty: 2 }, { title: "Jamun Raw Honey", size: "250 g", qty: 1 }], value: 2172, ago: "3 hrs ago", status: "WhatsApp sent" },
  { id: "AC-219", customer: "Arjun Patel", phone: "919999000013", city: "Ahmedabad", items: [{ title: "Almond Oil", size: "50 ml", qty: 3 }], value: 954, ago: "Yesterday", status: "Not contacted" },
  { id: "AC-218", customer: "Seema Rao", phone: "919999000014", city: "Pune", items: [{ title: "Flaxseed Oil", size: "1 L", qty: 1 }], value: 924, ago: "Yesterday", status: "Recovered" },
  { id: "AC-217", customer: "Imran Khan", phone: "919999000015", city: "Kota", items: [{ title: "Black Sesame Oil", size: "500 ml", qty: 2 }], value: 1252, ago: "2 days ago", status: "WhatsApp sent" },
];

export type Discount = { code: string; type: string; value: string; used: number; status: "Active" | "Paused" };
export const discounts: Discount[] = [
  { code: "WELCOME10", type: "Percentage, first order", value: "10%", used: 38, status: "Active" },
  { code: "FREESHIP", type: "Free shipping", value: `Above ₹999`, used: 112, status: "Active" },
  { code: "DIWALI5", type: "Percentage", value: "5%", used: 9, status: "Paused" },
];

export type Review = { id: string; product: string; name: string; rating: number; text: string; verified: boolean; status: "Published" | "Pending" };
export const reviews: Review[] = [
  { id: "R-31", product: "Yellow Mustard Oil", name: "Ramesh S.", rating: 5, text: "Strong aroma, tastes like the oil we had in the village.", verified: true, status: "Published" },
  { id: "R-30", product: "Groundnut Oil", name: "Sunita V.", rating: 4, text: "Good for frying. Packing could be better.", verified: true, status: "Pending" },
  { id: "R-29", product: "Jamun Raw Honey", name: "Kavita S.", rating: 5, text: "Thick and dark. Not too sweet.", verified: true, status: "Published" },
];

