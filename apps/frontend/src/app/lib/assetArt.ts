import type { AssetType } from "./assetMeta";

const paletteByType: Record<AssetType, { from: string; to: string; glow: string }> = {
  "real-estate": { from: "#2563eb", to: "#60a5fa", glow: "#bfdbfe" },
  art: { from: "#a21caf", to: "#f472b6", glow: "#f5d0fe" },
  bonds: { from: "#059669", to: "#34d399", glow: "#bbf7d0" },
  commodities: { from: "#d97706", to: "#fbbf24", glow: "#fde68a" },
  equity: { from: "#4338ca", to: "#818cf8", glow: "#c7d2fe" },
  "private-credit": { from: "#0f766e", to: "#22d3ee", glow: "#a5f3fc" },
  "carbon-assets": { from: "#4d7c0f", to: "#84cc16", glow: "#d9f99d" },
  infrastructure: { from: "#0369a1", to: "#38bdf8", glow: "#bae6fd" },
  "precious-metals": { from: "#a16207", to: "#facc15", glow: "#fde68a" },
  "ip-royalties": { from: "#e11d48", to: "#fb7185", glow: "#fecdd3" },
  "carbon-credits": { from: "#4d7c0f", to: "#84cc16", glow: "#d9f99d" },
  "luxury-goods": { from: "#7c3aed", to: "#c084fc", glow: "#e9d5ff" },
  restricted: { from: "#991b1b", to: "#ef4444", glow: "#fecaca" },
};

function escapeXml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function getAssetArtwork(title: string, subtitle: string, type: AssetType) {
  const palette = paletteByType[type];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="900" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.from}" />
          <stop offset="100%" stop-color="${palette.to}" />
        </linearGradient>
      </defs>
      <rect width="1200" height="900" fill="url(#bg)" />
      <circle cx="960" cy="180" r="220" fill="${palette.glow}" opacity="0.28" />
      <circle cx="220" cy="760" r="200" fill="${palette.glow}" opacity="0.18" />
      <path d="M0 640 C240 560 320 830 620 760 C860 706 940 520 1200 560 V900 H0 Z" fill="rgba(255,255,255,0.16)" />
      <rect x="80" y="90" width="1040" height="720" rx="42" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.2)" />
      <text x="120" y="180" fill="white" font-size="34" font-family="Segoe UI, Arial, sans-serif" opacity="0.82">${escapeXml(subtitle)}</text>
      <text x="120" y="270" fill="white" font-size="78" font-weight="700" font-family="Segoe UI, Arial, sans-serif">${escapeXml(title)}</text>
      <text x="120" y="720" fill="white" font-size="28" font-family="Segoe UI, Arial, sans-serif" opacity="0.7">Web3ID RWA Collection</text>
      <g transform="translate(860 600)">
        <circle r="110" fill="rgba(255,255,255,0.16)" />
        <circle r="64" fill="rgba(255,255,255,0.24)" />
        <circle r="20" fill="white" opacity="0.9" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
