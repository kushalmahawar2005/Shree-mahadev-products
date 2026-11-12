import { AlignLeft, ChevronDown as LChevronDown, Search, ShoppingBag, Store, X } from "lucide-react";

type P = { className?: string };


// Storefront icons: lucide, one consistent stroke weight.
const sw = 1.6;
export const SearchIcon = ({ className = "size-6" }: P) => <Search className={className} strokeWidth={sw} aria-hidden />;
export const BagIcon = ({ className = "size-6" }: P) => <ShoppingBag className={className} strokeWidth={sw} aria-hidden />;
// Account: person outline with a saffron bolt, hand-drawn SVG (no library icon has the bolt).
export const UserIcon = ({ className = "size-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
    <circle cx="9.5" cy="7.5" r="3.75" stroke="currentColor" strokeWidth={sw * 1.15} />
    <path d="M3 20.25v-.75a6.5 6.5 0 0 1 9.6-5.7" stroke="currentColor" strokeWidth={sw * 1.15} strokeLinecap="round" />
    <path d="M18.6 10.5 14.4 16.4h3.1l-1 5.1 4.6-6.4h-3.2l.7-4.6Z" fill="#F0A020" stroke="#F0A020" strokeWidth={0.6} strokeLinejoin="round" />
  </svg>
);
export const MenuIcon = ({ className = "size-6" }: P) => <AlignLeft className={className} strokeWidth={sw} aria-hidden />;
export const CloseIcon = ({ className = "size-6" }: P) => <X className={className} strokeWidth={sw} aria-hidden />;
export const ShopIcon = ({ className = "size-6" }: P) => <Store className={className} strokeWidth={sw} aria-hidden />;
export const ChevronDown = ({ className = "size-4" }: P) => <LChevronDown className={className} strokeWidth={2} aria-hidden />;

export const WhatsAppIcon = ({ className = "size-6" }: P) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.1-.3-.2-.5-.3z" />
  </svg>
);
