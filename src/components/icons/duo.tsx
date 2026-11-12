/**
 * Storefront feature icons: Phosphor "duotone" set, exported under the lucide names the code
 * already uses, so swapping an icon is just moving it from the `lucide-react` import to this one.
 *
 * Look: the outline takes the text colour (currentColor); the soft inner layer is recoloured to
 * brand mustard. Pass `mono` for faint watermark marks so the inner layer stays currentColor.
 *
 * Use these for content/feature icons (trust points, contact tiles, section marks, badges).
 * Keep plain lucide for small UI controls (arrows, chevrons, close, plus/minus, spinners, stars).
 *
 * Built on the `/ssr` entry (no React context), so it works in server and client components.
 */
import type { Icon as PhosphorIcon, IconProps } from "@phosphor-icons/react";
import {
  Baby as PBaby,
  BowlSteam as PBowlSteam,
  BookOpen as PBookOpen,
  CalendarBlank,
  CalendarCheck,
  Camera as PCamera,
  CheckCircle,
  ChefHat as PChefHat,
  Clock as PClock,
  Confetti,
  Cookie as PCookie,
  CookingPot as PCookingPot,
  CreditCard as PCreditCard,
  Cube,
  Cylinder,
  Drop,
  EnvelopeSimple,
  Factory as PFactory,
  FileText as PFileText,
  FlowerLotus,
  Fire,
  Flask,
  FunnelSimpleX,
  Grains,
  Hourglass as PHourglass,
  Jar as PJar,
  Leaf as PLeaf,
  Lightbulb as PLightbulb,
  Lightning,
  Lock as PLock,
  MapPin as PMapPin,
  Money,
  Package as PPackage,
  Palette as PPalette,
  PencilSimpleLine,
  Phone as PPhone,
  Plant,
  PlayCircle as PPlayCircle,
  Prohibit,
  SealCheck,
  SealPercent,
  ShieldCheck as PShieldCheck,
  Sparkle,
  Storefront,
  Sun as PSun,
  TestTube,
  ThermometerCold,
  Ticket,
  Timer as PTimer,
  Truck as PTruck,
  User,
  WarningCircle,
  WhatsappLogo,
  XCircle as PXCircle,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils/cn";

/** Recolours Phosphor's duotone layer (the path carrying an `opacity` attribute) to mustard. */
const MUSTARD = "[&_path[opacity]]:fill-[#E0A526] [&_path[opacity]]:opacity-45";

export type DuoProps = Omit<IconProps, "weight"> & { mono?: boolean };
export type DuoIcon = React.FC<DuoProps>;

function duo(Base: PhosphorIcon, name: string): DuoIcon {
  // size 24 by default, like lucide; a Tailwind size-* class still wins.
  function Duo({ mono, className, size = 24, ...rest }: DuoProps) {
    return <Base weight="duotone" size={size} className={cn(!mono && MUSTARD, className)} {...rest} />;
  }
  Duo.displayName = `Duo${name}`;
  return Duo;
}

// Delivery, packs, places
export const Truck = duo(PTruck, "Truck");
export const Package = duo(PPackage, "Package");
export const PackageCheck = duo(PPackage, "PackageCheck");
export const Boxes = duo(Cube, "Boxes");
export const Tin = duo(Cylinder, "Tin");
export const MapPin = duo(PMapPin, "MapPin");
export const Store = duo(Storefront, "Store");
export const Factory = duo(PFactory, "Factory");

// Purity, nature, proof
export const Leaf = duo(PLeaf, "Leaf");
export const Sprout = duo(Plant, "Sprout");
export const Droplets = duo(Drop, "Droplets");
export const Wheat = duo(Grains, "Wheat");
export const Sun = duo(PSun, "Sun");
export const ShieldCheck = duo(PShieldCheck, "ShieldCheck");
export const BadgeCheck = duo(SealCheck, "BadgeCheck");
export const FlaskConical = duo(Flask, "FlaskConical");
export const FlaskConicalOff = duo(TestTube, "FlaskConicalOff");
export const FilterX = duo(FunnelSimpleX, "FilterX");
export const ThermometerSnowflake = duo(ThermometerCold, "ThermometerSnowflake");
export const Ban = duo(Prohibit, "Ban");
export const Hourglass = duo(PHourglass, "Hourglass");
export const Timer = duo(PTimer, "Timer");
export const Palette = duo(PPalette, "Palette");

// Kitchen uses
export const CookingPot = duo(PCookingPot, "CookingPot");
export const Flame = duo(Fire, "Flame");
export const Cookie = duo(PCookie, "Cookie");
export const Baby = duo(PBaby, "Baby");
export const Sparkles = duo(Sparkle, "Sparkles");
export const ChefHat = duo(PChefHat, "ChefHat");
export const Lightbulb = duo(PLightbulb, "Lightbulb");
export const BowlSteam = duo(PBowlSteam, "BowlSteam");
export const Jar = duo(PJar, "Jar");
export const Lotus = duo(FlowerLotus, "Lotus");

// Contact, content
export const Phone = duo(PPhone, "Phone");
export const Mail = duo(EnvelopeSimple, "Mail");
export const WhatsApp = duo(WhatsappLogo, "WhatsApp");
// Every storefront "chat" link opens WhatsApp, so the chat icon is the WhatsApp mark.
export const MessageCircle = duo(WhatsappLogo, "MessageCircle");
export const Clock = duo(PClock, "Clock");
export const CalendarDays = duo(CalendarBlank, "CalendarDays");
export const CalendarClock = duo(CalendarCheck, "CalendarClock");
export const BookOpen = duo(PBookOpen, "BookOpen");
export const FileText = duo(PFileText, "FileText");
export const PlayCircle = duo(PPlayCircle, "PlayCircle");
export const Camera = duo(PCamera, "Camera");
export const PenLine = duo(PencilSimpleLine, "PenLine");
export const UserRound = duo(User, "UserRound");

// Money, offers, status
export const Banknote = duo(Money, "Banknote");
export const CreditCard = duo(PCreditCard, "CreditCard");
export const Lock = duo(PLock, "Lock");
export const BadgePercent = duo(SealPercent, "BadgePercent");
export const TicketPercent = duo(Ticket, "TicketPercent");
export const Zap = duo(Lightning, "Zap");
export const PartyPopper = duo(Confetti, "PartyPopper");
export const CheckCircle2 = duo(CheckCircle, "CheckCircle2");
export const AlertCircle = duo(WarningCircle, "AlertCircle");
export const XCircle = duo(PXCircle, "XCircle");
