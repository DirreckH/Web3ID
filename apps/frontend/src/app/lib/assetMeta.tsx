import {
  Briefcase,
  Building2,
  FileBarChart2,
  Gem,
  Leaf,
  Music4,
  Package,
  ShieldAlert,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type AssetType =
  | "real-estate"
  | "art"
  | "bonds"
  | "commodities"
  | "equity"
  | "ip-royalties"
  | "carbon-credits"
  | "luxury-goods"
  | "restricted";

interface AssetMeta {
  label: string;
  Icon: LucideIcon;
  chipClass: string;
  iconWrapClass: string;
  accentColor: string;
}

const assetMeta: Record<AssetType, AssetMeta> = {
  "real-estate": {
    label: "Real Estate",
    Icon: Building2,
    chipClass: "bg-blue-50 text-blue-700",
    iconWrapClass: "bg-blue-100 text-blue-700",
    accentColor: "#2563eb",
  },
  art: {
    label: "Fine Art",
    Icon: Sparkles,
    chipClass: "bg-fuchsia-50 text-fuchsia-700",
    iconWrapClass: "bg-fuchsia-100 text-fuchsia-700",
    accentColor: "#c026d3",
  },
  bonds: {
    label: "Bonds",
    Icon: FileBarChart2,
    chipClass: "bg-emerald-50 text-emerald-700",
    iconWrapClass: "bg-emerald-100 text-emerald-700",
    accentColor: "#059669",
  },
  commodities: {
    label: "Commodities",
    Icon: Package,
    chipClass: "bg-amber-50 text-amber-700",
    iconWrapClass: "bg-amber-100 text-amber-700",
    accentColor: "#d97706",
  },
  equity: {
    label: "Equity",
    Icon: Briefcase,
    chipClass: "bg-indigo-50 text-indigo-700",
    iconWrapClass: "bg-indigo-100 text-indigo-700",
    accentColor: "#4f46e5",
  },
  "ip-royalties": {
    label: "IP Royalties",
    Icon: Music4,
    chipClass: "bg-rose-50 text-rose-700",
    iconWrapClass: "bg-rose-100 text-rose-700",
    accentColor: "#e11d48",
  },
  "carbon-credits": {
    label: "Carbon Credits",
    Icon: Leaf,
    chipClass: "bg-lime-50 text-lime-700",
    iconWrapClass: "bg-lime-100 text-lime-700",
    accentColor: "#65a30d",
  },
  "luxury-goods": {
    label: "Luxury Goods",
    Icon: Gem,
    chipClass: "bg-violet-50 text-violet-700",
    iconWrapClass: "bg-violet-100 text-violet-700",
    accentColor: "#7c3aed",
  },
  restricted: {
    label: "Restricted",
    Icon: ShieldAlert,
    chipClass: "bg-red-50 text-red-700",
    iconWrapClass: "bg-red-100 text-red-700",
    accentColor: "#dc2626",
  },
};

export function getAssetMeta(type: AssetType) {
  return assetMeta[type];
}
