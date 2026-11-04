export const INQUIRY_STATUSES = ["new", "contacted", "quoted", "won", "lost"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

export type Inquiry = {
  id: number;
  name: string;
  business: string;
  city: string;
  phone: string;
  email: string;
  product: string;
  quantity: string;
  message: string;
  status: InquiryStatus;
  assignee: string;
  followUpAt: string;
  quoteAmount: number | null;
  createdAt: string;
  notes: { id: number; author: string; body: string; createdAt: string }[];
};
