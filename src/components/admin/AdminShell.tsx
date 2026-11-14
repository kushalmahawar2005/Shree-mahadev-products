"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ChevronsUpDown,
  Clapperboard,
  ExternalLink,
  FolderTree,
  History,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Star,
  TicketPercent,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
  LifeBuoy,
  BookOpenText,
} from "lucide-react";
import { logoutAction } from "@/lib/admin-login-actions";
import { Avatar, AvatarFallback } from "@/components/shadcn/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/shadcn/breadcrumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Separator } from "@/components/shadcn/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/shadcn/sidebar";
import { CommandMenu, openCommandMenu } from "./CommandMenu";
import { ThemeToggle } from "./ThemeToggle";

export type AdminRole = "owner" | "manager" | "staff";
export type AdminNavItem = { label: string; href: string; section: string; icon: LucideIcon };

export const ADMIN_NAV: AdminNavItem[] = [
  { label: "Dashboard", href: "/admin", section: "Overview", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", section: "Sales", icon: ShoppingBag },
  { label: "Products", href: "/admin/products", section: "Catalog", icon: Package },
  { label: "Inventory", href: "/admin/inventory", section: "Catalog", icon: Boxes },
  { label: "Collections", href: "/admin/categories", section: "Catalog", icon: FolderTree },
  { label: "Abandoned carts", href: "/admin/abandoned-carts", section: "Customers", icon: ShoppingCart },
  { label: "Customers", href: "/admin/customers", section: "Customers", icon: Users },
  { label: "Help desk", href: "/admin/helpdesk", section: "Customers", icon: LifeBuoy },
  { label: "Coupons", href: "/admin/discounts", section: "Growth", icon: TicketPercent },
  { label: "Reviews", href: "/admin/reviews", section: "Growth", icon: Star },
  { label: "Bulk inquiries", href: "/admin/inquiries", section: "Growth", icon: Inbox },
  { label: "Marketing", href: "/admin/marketing", section: "Growth", icon: Megaphone },
  { label: "Messages", href: "/admin/messages", section: "Operations", icon: MessageSquare },
  { label: "Shipping ops", href: "/admin/shipping", section: "Operations", icon: Truck },
  { label: "Reports", href: "/admin/reports", section: "Operations", icon: BarChart3 },
  { label: "Home banners", href: "/admin/banners", section: "Website", icon: ImageIcon },
  { label: "Reels", href: "/admin/videos", section: "Website", icon: Clapperboard },
  { label: "Product page content", href: "/admin/product-stories", section: "Website", icon: BookOpenText },
  { label: "Settings", href: "/admin/settings", section: "Settings", icon: Settings },
  { label: "Admin users", href: "/admin/settings/users", section: "Settings", icon: UserCog },
  { label: "Activity log", href: "/admin/activity", section: "Settings", icon: History },
];

const OWNER_ONLY = ["/admin/settings", "/admin/settings/users", "/admin/activity"];
const STAFF_PAGES = ["/admin", "/admin/orders", "/admin/helpdesk", "/admin/inquiries", "/admin/reviews"];

export function navForRole(role: AdminRole) {
  return ADMIN_NAV.filter((n) =>
    role === "owner" ? true : role === "manager" ? !OWNER_ONLY.includes(n.href) : STAFF_PAGES.includes(n.href),
  );
}

const isActive = (pathname: string, href: string) =>
  href === "/admin" || href === "/admin/settings" ? pathname === href : pathname.startsWith(href);

const ROLE_LABEL: Record<AdminRole, string> = { owner: "Owner", manager: "Manager", staff: "Staff" };

export function AdminShell({
  children,
  role,
  username,
  badges = {},
}: {
  children: React.ReactNode;
  role: AdminRole;
  username: string;
  /** Open-item counts shown next to nav items, keyed by href. */
  badges?: Record<string, number>;
}) {
  const pathname = usePathname();
  // The login page has no admin chrome.
  if (pathname === "/admin/login") return <>{children}</>;

  const items = navForRole(role);
  const sections = [...new Set(items.map((n) => n.section))];
  const current = [...items].reverse().find((n) => isActive(pathname, n.href));
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="px-3 pt-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="hover:bg-sidebar-accent">
                <Link href="/admin">
                  <Image
                    src="https://res.cloudinary.com/bmqxsylj/image/upload/f_auto,q_auto:good,c_limit,w_160/v1793735979/swadeshi-mahadev/static/logo.png"
                    alt=""
                    width={36}
                    height={36}
                    unoptimized
                    className="size-9 shrink-0 rounded-full bg-white/10 object-contain ring-1 ring-white/15"
                  />
                  <span className="grid leading-tight">
                    <span className="truncate font-semibold text-white">Mahadev</span>
                    <span className="truncate text-xs text-sidebar-foreground/70">Admin workspace</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent className="px-1 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-24px),transparent)]">
          {sections.map((section) => (
            <SidebarGroup key={section} className="py-1.5">
              <SidebarGroupLabel className="text-[11px] font-semibold tracking-wide text-sidebar-foreground/45">
                {section}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items
                    .filter((n) => n.section === section)
                    .map((n) => {
                      const active = isActive(pathname, n.href);
                      return (
                        <SidebarMenuItem key={n.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={active}
                            tooltip={n.label}
                            className="h-9 text-[14px] font-medium text-sidebar-foreground transition-colors data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-white"
                          >
                            <Link href={n.href} aria-current={active ? "page" : undefined}>
                              <n.icon className={active ? "text-sidebar-primary" : "opacity-80"} />
                              <span>{n.label}</span>
                            </Link>
                          </SidebarMenuButton>
                          {!!badges[n.href] && (
                            <SidebarMenuBadge className="rounded-full bg-mustard/90 px-1.5 text-[11px] font-bold text-forest-text tabular-nums">{badges[n.href]}</SidebarMenuBadge>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="px-3 pb-4">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="View storefront" className="text-sidebar-foreground">
                <Link href="/" target="_blank">
                  <ExternalLink />
                  <span>View storefront</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0 bg-canvas">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface/85 px-3 backdrop-blur-md sm:px-5">
          <SidebarTrigger className="-ml-1 size-9 text-forest-text" />
          <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="flex-nowrap">
              {current && current.section !== current.label && (
                <>
                  <BreadcrumbItem className="hidden md:inline-flex">{current.section}</BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbPage className="truncate font-semibold text-forest-text">
                  {current?.label ?? "Admin"}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={openCommandMenu}
              className="hidden h-10 w-64 items-center gap-2 rounded-full border border-line bg-subtle px-4 text-sm text-ink-muted transition-colors hover:border-forest/40 hover:text-ink md:flex"
            >
              <Search className="size-4" />
              Search or jump to…
              <kbd className="ml-auto rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold">
                ⌘K
              </kbd>
            </button>
            <button
              type="button"
              onClick={openCommandMenu}
              aria-label="Search"
              className="grid size-10 place-items-center rounded-full border border-line text-forest-text hover:bg-khaki-soft md:hidden"
            >
              <Search className="size-4" />
            </button>
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition-colors hover:bg-khaki-soft focus-visible:outline-2 focus-visible:outline-mustard">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-forest text-xs font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
                <span className="hidden text-left leading-tight sm:grid">
                  <span className="max-w-28 truncate text-sm font-semibold text-forest-text">{username}</span>
                  <span className="text-[11px] text-ink-muted">{ROLE_LABEL[role]}</span>
                </span>
                <ChevronsUpDown className="hidden size-3.5 text-ink-muted sm:block" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <span className="block font-semibold text-forest-text">{username}</span>
                  <span className="text-xs text-ink-muted">{ROLE_LABEL[role]} · Swadeshi Mahadev</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/" target="_blank">
                    <ExternalLink /> View storefront
                  </Link>
                </DropdownMenuItem>
                {role === "owner" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings">
                      <Settings /> Settings
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <form action={logoutAction}>
                  <DropdownMenuItem asChild variant="destructive">
                    <button type="submit" className="w-full">
                      <LogOut /> Log out
                    </button>
                  </DropdownMenuItem>
                </form>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 xl:p-8">
          {children}
        </main>
      </SidebarInset>
      <CommandMenu items={items} />
    </SidebarProvider>
  );
}
