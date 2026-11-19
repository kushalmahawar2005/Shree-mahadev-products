/** Customer support settings for /account/help (placeholders until the client confirms). */
export const supportConfig = {
  /** Team hours in IST. Days use JS numbering: 0 = Sunday … 6 = Saturday. */
  hours: { days: [1, 2, 3, 4, 5, 6] as readonly number[], open: 9, close: 18, label: "Mon–Sat, 9 AM–6 PM" },
  /** Shown while the team is online. */
  replyTime: "~15 min",
  /** Call-back windows a shopper can pick (inside working hours). */
  callbackSlots: ["10 AM–12 PM", "12–2 PM", "2–4 PM", "4–6 PM"] as const,
  /** Bank/UPI auto-reversal window for a failed online payment. */
  autoRefundDays: "5–7 working days",
  messageMax: 500,
  photos: {
    max: 3,
    maxBytes: 5 * 1024 * 1024,
    /** Cloudinary format names accepted for help photos. */
    formats: ["jpg", "jpeg", "png", "webp", "heic", "heif"] as const,
    mime: ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const,
  },
  /** Unboxing video: required for damage / expiry claims (see /policies/refund-return). */
  video: {
    max: 1,
    /** Cloudinary's single-request upload limit on our plan. */
    maxBytes: 100 * 1024 * 1024,
    formats: ["mp4", "mov", "webm", "3gp", "m4v"] as const,
    mime: ["video/mp4", "video/quicktime", "video/webm", "video/3gpp", "video/x-m4v"] as const,
  },
  /** New help requests per customer per hour. */
  ticketsPerHour: 5,
} as const;

export type CallbackSlot = (typeof supportConfig.callbackSlots)[number];
