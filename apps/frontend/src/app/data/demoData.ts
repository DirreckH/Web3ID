import { getAssetArtwork } from "../lib/assetArt";
import type { AssetType } from "../lib/assetMeta";

export interface TradeAssetQuote {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  leverage: string;
  description: string;
  image: string;
  location: string;
  apy: number;
  available: number;
  totalValue: number;
  status: CatalogAsset["status"];
}

export type TradeProductType = "spot" | "futures" | "index" | "etf";

export interface TradeInstrument extends TradeAssetQuote {
  underlyingId: string;
  productType: TradeProductType;
}

export interface PortfolioPosition {
  id: string;
  name: string;
  symbol: string;
  type: AssetType;
  amount: number;
  avgPrice: number;
  currentPrice: number;
  totalValue: number;
  costBasis: number;
  pnl: number;
  pnlPercent: number;
  allocation: number;
}

export interface TransactionRecord {
  id: string;
  type: "buy" | "sell";
  assetName: string;
  assetType: AssetType;
  assetSymbol: string;
  amount: number;
  price: number;
  total: number;
  fee: number;
  status: "completed" | "pending" | "failed";
  date: string;
  time: string;
  txHash: string;
}

export interface CatalogAsset {
  id: string;
  name: string;
  type: AssetType;
  image: string;
  price: number;
  apy: number;
  totalValue: number;
  available: number;
  location: string;
  status: "active" | "sold-out" | "coming-soon";
  description: string;
}

type TradeUniverseAssetType = Extract<
  AssetType,
  | "real-estate"
  | "bonds"
  | "commodities"
  | "equity"
  | "private-credit"
  | "carbon-assets"
  | "carbon-credits"
  | "infrastructure"
  | "precious-metals"
  | "art"
  | "ip-royalties"
  | "luxury-goods"
  | "restricted"
>;

interface TradeUnderlying {
  id: string;
  symbol: string;
  name: string;
  type: TradeUniverseAssetType;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  description: string;
  location?: string;
  apy?: number;
  available?: number;
  totalValue?: number;
  status?: CatalogAsset["status"];
}

const tradeProductConfig: Record<
  TradeProductType,
  {
    label: string;
    idSuffix: string;
    symbolSuffix: string;
    priceMultiplier: number;
    changeOffset: number;
    volumeMultiplier: number;
    marketCapMultiplier: number;
    leverage: string;
    descriptionPrefix: string;
  }
> = {
  spot: {
    label: "Spot",
    idSuffix: "",
    symbolSuffix: "",
    priceMultiplier: 1,
    changeOffset: 0,
    volumeMultiplier: 1,
    marketCapMultiplier: 1,
    leverage: "3x",
    descriptionPrefix: "Direct market access to ",
  },
  futures: {
    label: "Futures",
    idSuffix: "futures",
    symbolSuffix: "F",
    priceMultiplier: 1.04,
    changeOffset: 1.18,
    volumeMultiplier: 1.32,
    marketCapMultiplier: 1.08,
    leverage: "10x",
    descriptionPrefix: "Quarterly futures exposure on ",
  },
  index: {
    label: "Index",
    idSuffix: "index",
    symbolSuffix: "I",
    priceMultiplier: 0.88,
    changeOffset: -0.54,
    volumeMultiplier: 0.84,
    marketCapMultiplier: 0.92,
    leverage: "2x",
    descriptionPrefix: "Benchmark basket tracking ",
  },
  etf: {
    label: "ETF",
    idSuffix: "etf",
    symbolSuffix: "E",
    priceMultiplier: 0.94,
    changeOffset: 0.36,
    volumeMultiplier: 1.12,
    marketCapMultiplier: 1.16,
    leverage: "4x",
    descriptionPrefix: "Fund wrapper allocating to ",
  },
};

export const tradeUnderlyings: TradeUnderlying[] = [
  {
    id: "nyc",
    symbol: "NYC",
    name: "Manhattan Core REIT",
    type: "real-estate",
    price: 0.04461,
    change24h: 8.46,
    volume24h: 142_330_000,
    marketCap: 450_000_000,
    description: "stabilized Manhattan rental cash flow with institutional-grade occupancy.",
    location: "New York, United States",
    apy: 8.5,
    available: 15,
    totalValue: 5_000_000,
    status: "active",
  },
  {
    id: "sg-reit",
    symbol: "SGRE",
    name: "Singapore Logistics REIT",
    type: "real-estate",
    price: 0.06122,
    change24h: 5.18,
    volume24h: 92_400_000,
    marketCap: 398_000_000,
    description: "prime warehouse and cold-chain rent rolls backed by regional e-commerce throughput.",
    location: "Singapore",
    apy: 7.9,
    available: 18,
    totalValue: 4_200_000,
    status: "active",
  },
  {
    id: "dubai-reit",
    symbol: "DBHT",
    name: "Dubai Hospitality Trust",
    type: "real-estate",
    price: 0.05794,
    change24h: 4.62,
    volume24h: 88_210_000,
    marketCap: 372_000_000,
    description: "hotel and branded-residence cash flow linked to resilient GCC tourism demand.",
    location: "Dubai, United Arab Emirates",
    apy: 9.2,
    available: 9,
    totalValue: 6_000_000,
    status: "active",
  },
  {
    id: "bond",
    symbol: "BOND",
    name: "US Treasury Ladder",
    type: "bonds",
    price: 0.2323,
    change24h: 8.4,
    volume24h: 7_967_600,
    marketCap: 1_200_000_000,
    description: "short-duration sovereign paper designed for lower-volatility yield exposure.",
  },
  {
    id: "euro-note",
    symbol: "EUBD",
    name: "Euro Investment Grade Note",
    type: "bonds",
    price: 0.3418,
    change24h: 2.44,
    volume24h: 6_210_000,
    marketCap: 940_000_000,
    description: "eurozone corporate bond sleeve focused on liquid investment-grade carry.",
  },
  {
    id: "asia-sovereign",
    symbol: "ASOV",
    name: "Asia Sovereign Yield Basket",
    type: "bonds",
    price: 0.2875,
    change24h: 3.07,
    volume24h: 5_870_000,
    marketCap: 810_000_000,
    description: "regional sovereign paper diversified across higher-quality Asia-Pacific issuers.",
  },
  {
    id: "cmdty",
    symbol: "CMDX",
    name: "Global Commodity Reserve",
    type: "commodities",
    price: 12.68,
    change24h: 4.78,
    volume24h: 12_440_000,
    marketCap: 680_000_000,
    description: "an energy and agriculture basket with rolling spot inventory reference pricing.",
  },
  {
    id: "copper",
    symbol: "COPR",
    name: "Strategic Copper Basket",
    type: "commodities",
    price: 14.21,
    change24h: 6.03,
    volume24h: 10_880_000,
    marketCap: 624_000_000,
    description: "warehouse-backed copper exposure aligned with electrification and grid build-out demand.",
  },
  {
    id: "agri",
    symbol: "AGRI",
    name: "Agricultural Staples Pool",
    type: "commodities",
    price: 9.84,
    change24h: 3.58,
    volume24h: 8_120_000,
    marketCap: 512_000_000,
    description: "corn, wheat, and soy inventory exposure tuned for food-supply volatility hedging.",
  },
  {
    id: "equity",
    symbol: "EQTY",
    name: "AI Growth Equity",
    type: "equity",
    price: 18.42,
    change24h: 6.21,
    volume24h: 9_860_000,
    marketCap: 540_000_000,
    description: "late-stage private growth equity tied to AI infrastructure and software revenue.",
    location: "California, United States",
    apy: 25,
    available: 40,
    totalValue: 5_000_000,
    status: "active",
  },
  {
    id: "biotech",
    symbol: "BIOX",
    name: "Biotech Secondary Equity",
    type: "equity",
    price: 21.37,
    change24h: 4.79,
    volume24h: 7_430_000,
    marketCap: 468_000_000,
    description: "secondary-market life-science equity linked to late-clinical assets and platform royalties.",
    location: "Boston, United States",
    apy: 18.4,
    available: 28,
    totalValue: 4_200_000,
    status: "active",
  },
  {
    id: "sea-tech",
    symbol: "SEAD",
    name: "SEA Digital Commerce Equity",
    type: "equity",
    price: 16.94,
    change24h: 5.41,
    volume24h: 8_910_000,
    marketCap: 492_000_000,
    description: "growth-stage commerce and payments equity anchored in Southeast Asia consumer demand.",
    location: "Singapore",
    apy: 17.1,
    available: 26,
    totalValue: 4_000_000,
    status: "active",
  },
  {
    id: "credit",
    symbol: "CRDT",
    name: "Middle Market Credit",
    type: "private-credit",
    price: 4.82,
    change24h: 3.14,
    volume24h: 5_420_000,
    marketCap: 310_000_000,
    description: "senior secured direct-lending cash flows sourced from sponsor-backed borrowers.",
  },
  {
    id: "asset-backed",
    symbol: "ABSF",
    name: "Asset-Backed Finance Note",
    type: "private-credit",
    price: 6.14,
    change24h: 2.91,
    volume24h: 4_860_000,
    marketCap: 286_000_000,
    description: "short-duration receivables financing exposure backed by diversified operating collateral.",
  },
  {
    id: "nav-lend",
    symbol: "NAVL",
    name: "NAV Lending Senior Fund",
    type: "private-credit",
    price: 5.73,
    change24h: 3.36,
    volume24h: 4_510_000,
    marketCap: 274_000_000,
    description: "senior capital to private funds with diversified portfolio-company value support.",
  },
  {
    id: "carbon",
    symbol: "CARB",
    name: "Rainforest Carbon Reserve",
    type: "carbon-assets",
    price: 2.31,
    change24h: 5.67,
    volume24h: 4_280_000,
    marketCap: 210_000_000,
    description: "verified nature-based credits with registry-backed retirement and issuance data.",
  },
  {
    id: "blue-carbon",
    symbol: "BLUE",
    name: "Blue Carbon Mangrove Trust",
    type: "carbon-assets",
    price: 2.68,
    change24h: 4.84,
    volume24h: 3_970_000,
    marketCap: 198_000_000,
    description: "mangrove and coastal sequestration credits carrying higher-quality permanence profiles.",
  },
  {
    id: "allowance",
    symbol: "EUCR",
    name: "Compliance Allowance Reserve",
    type: "carbon-assets",
    price: 3.12,
    change24h: 3.95,
    volume24h: 4_430_000,
    marketCap: 226_000_000,
    description: "compliance-market carbon allowance exposure structured for regulated emissions hedging.",
  },
  {
    id: "infra",
    symbol: "INFR",
    name: "Digital Infrastructure Trust",
    type: "infrastructure",
    price: 9.74,
    change24h: 4.11,
    volume24h: 6_940_000,
    marketCap: 420_000_000,
    description: "data-center and fiber-network cash flow with long-duration contracted revenue.",
  },
  {
    id: "grid",
    symbol: "GRID",
    name: "Renewable Grid Platform",
    type: "infrastructure",
    price: 11.28,
    change24h: 4.57,
    volume24h: 6_220_000,
    marketCap: 404_000_000,
    description: "regulated transmission and storage assets tied to renewable interconnection expansion.",
  },
  {
    id: "port",
    symbol: "PORT",
    name: "Port Logistics Corridor",
    type: "infrastructure",
    price: 8.93,
    change24h: 3.88,
    volume24h: 5_740_000,
    marketCap: 376_000_000,
    description: "toll-road and port throughput revenue diversified across regional freight gateways.",
  },
  {
    id: "gold",
    symbol: "GOLD",
    name: "Vaulted Gold Reserve",
    type: "precious-metals",
    price: 33.99,
    change24h: 7.87,
    volume24h: 6_581_400,
    marketCap: 890_000_000,
    description: "fully allocated bullion custody designed for liquid precious-metals access.",
    location: "Zurich Bullion Vault",
    apy: 4.5,
    available: 200,
    totalValue: 15_000_000,
    status: "active",
  },
  {
    id: "silverx",
    symbol: "SLVR",
    name: "Silver Treasury Reserve",
    type: "precious-metals",
    price: 28.64,
    change24h: 5.26,
    volume24h: 5_910_000,
    marketCap: 612_000_000,
    description: "industrial and monetary silver exposure held through audited reserve vaults.",
    location: "London Bullion Market",
    apy: 5.1,
    available: 160,
    totalValue: 11_200_000,
    status: "active",
  },
  {
    id: "platinum",
    symbol: "PLAT",
    name: "Platinum Strategic Pool",
    type: "precious-metals",
    price: 31.18,
    change24h: 4.48,
    volume24h: 4_980_000,
    marketCap: 534_000_000,
    description: "platinum reserve allocation linked to autocatalyst demand and constrained mine supply.",
    location: "Johannesburg Vault",
    apy: 4.8,
    available: 120,
    totalValue: 9_800_000,
    status: "active",
  },
  {
    id: "amazon-carbon",
    symbol: "AMZN",
    name: "Amazon Carbon Reserve",
    type: "carbon-credits",
    price: 2.95,
    change24h: 5.21,
    volume24h: 4_640_000,
    marketCap: 244_000_000,
    description: "verified rainforest credit inventory with retirement-ready registry provenance.",
    location: "Para, Brazil",
    apy: 10.5,
    available: 250,
    totalValue: 4_000_000,
    status: "active",
  },
  {
    id: "wind-credit",
    symbol: "WIND",
    name: "Wind Farm Carbon Credit",
    type: "carbon-credits",
    price: 2.64,
    change24h: 4.62,
    volume24h: 4_180_000,
    marketCap: 228_000_000,
    description: "renewable-energy carbon issuance aligned to compliance-friendly clean power projects.",
    location: "Nordics",
    apy: 8.9,
    available: 280,
    totalValue: 3_500_000,
    status: "active",
  },
  {
    id: "picasso",
    symbol: "PICA",
    name: "Picasso Limited Print",
    type: "art",
    price: 22.5,
    change24h: 6.14,
    volume24h: 3_860_000,
    marketCap: 240_000_000,
    description: "blue-chip collectible with insured custody and complete provenance history.",
    location: "Sotheby's Vault",
    apy: 12.3,
    available: 3,
    totalValue: 2_000_000,
    status: "active",
  },
  {
    id: "banksy",
    symbol: "BNKS",
    name: "Banksy Street Series",
    type: "art",
    price: 18.2,
    change24h: 7.08,
    volume24h: 3_420_000,
    marketCap: 198_000_000,
    description: "auction-tracked urban art exposure with insured storage and strong collector demand.",
    location: "Christie's Storage",
    apy: 15.8,
    available: 6,
    totalValue: 1_500_000,
    status: "active",
  },
  {
    id: "warhol",
    symbol: "WRHL",
    name: "Warhol Pop Art Basket",
    type: "art",
    price: 20.4,
    change24h: 5.76,
    volume24h: 3_180_000,
    marketCap: 212_000_000,
    description: "museum-grade pop art allocation structured for secondary-market fractional access.",
    location: "MoMA Reserve",
    apy: 11.5,
    available: 7,
    totalValue: 2_800_000,
    status: "active",
  },
  {
    id: "hollywood-ip",
    symbol: "HLWD",
    name: "Hollywood Franchise Royalty",
    type: "ip-royalties",
    price: 14.8,
    change24h: 5.44,
    volume24h: 3_960_000,
    marketCap: 286_000_000,
    description: "box-office and licensing cash flows sourced from globally recognized film franchises.",
    location: "Los Angeles, United States",
    apy: 14.2,
    available: 40,
    totalValue: 10_000_000,
    status: "active",
  },
  {
    id: "streaming-ip",
    symbol: "STRM",
    name: "Streaming Royalty Basket",
    type: "ip-royalties",
    price: 12.9,
    change24h: 6.07,
    volume24h: 4_210_000,
    marketCap: 264_000_000,
    description: "music and audio royalty income diversified across major subscription platforms.",
    location: "Spotify / Apple Music",
    apy: 16.5,
    available: 30,
    totalValue: 3_000_000,
    status: "active",
  },
  {
    id: "game-ip",
    symbol: "GAME",
    name: "AAA Game IP License",
    type: "ip-royalties",
    price: 16.4,
    change24h: 5.88,
    volume24h: 4_430_000,
    marketCap: 278_000_000,
    description: "licensing and merchandise revenue tied to top-tier gaming franchises and media rights.",
    location: "Global Licensing Network",
    apy: 19.8,
    available: 42,
    totalValue: 6_000_000,
    status: "active",
  },
  {
    id: "hermes-note",
    symbol: "HRMS",
    name: "Hermes Collection Note",
    type: "luxury-goods",
    price: 19.7,
    change24h: 4.91,
    volume24h: 2_980_000,
    marketCap: 188_000_000,
    description: "auction-backed luxury collectible tranche referencing rare handbag resale benchmarks.",
    location: "Paris, France",
    apy: 13.5,
    available: 18,
    totalValue: 2_000_000,
    status: "active",
  },
  {
    id: "patek-note",
    symbol: "PTEK",
    name: "Patek Philippe Reserve",
    type: "luxury-goods",
    price: 24.6,
    change24h: 5.67,
    volume24h: 2_740_000,
    marketCap: 214_000_000,
    description: "watch-backed structured exposure indexed to premium secondary-market transaction comps.",
    location: "Geneva, Switzerland",
    apy: 17.2,
    available: 16,
    totalValue: 5_000_000,
    status: "active",
  },
  {
    id: "wine-note",
    symbol: "WINE",
    name: "Rare Wine Cellar Note",
    type: "luxury-goods",
    price: 17.3,
    change24h: 4.38,
    volume24h: 2_520_000,
    marketCap: 176_000_000,
    description: "tokenized cellar inventory tracking rare-label appreciation and insured storage.",
    location: "Bordeaux, France",
    apy: 12,
    available: 42,
    totalValue: 3_000_000,
    status: "active",
  },
  {
    id: "defense-equity",
    symbol: "DEF",
    name: "North America Defense Equity",
    type: "restricted",
    price: 48.5,
    change24h: 3.9,
    volume24h: 1_840_000,
    marketCap: 322_000_000,
    description: "strategic defense exposure gated behind enhanced accreditation and policy review.",
    location: "Washington, United States",
    apy: 15,
    available: 5,
    totalValue: 100_000_000,
    status: "active",
  },
  {
    id: "swiss-energy",
    symbol: "SENG",
    name: "Swiss Energy Infrastructure",
    type: "restricted",
    price: 41.7,
    change24h: 2.84,
    volume24h: 1_620_000,
    marketCap: 284_000_000,
    description: "critical energy infrastructure available only to higher-tier reviewed identities.",
    location: "Bern, Switzerland",
    apy: 8.5,
    available: 10,
    totalValue: 50_000_000,
    status: "active",
  },
  {
    id: "satcom",
    symbol: "SATC",
    name: "Strategic SatCom Corridor",
    type: "restricted",
    price: 39.8,
    change24h: 3.21,
    volume24h: 1_760_000,
    marketCap: 296_000_000,
    description: "restricted communications infrastructure with jurisdiction-specific buyer controls.",
    location: "Luxembourg Secure Zone",
    apy: 9.4,
    available: 8,
    totalValue: 42_000_000,
    status: "active",
  },
];

function roundTradePrice(value: number) {
  return value < 1 ? Number(value.toFixed(5)) : Number(value.toFixed(2));
}

function createTradeInstrument(underlying: TradeUnderlying, productType: TradeProductType): TradeInstrument {
  const config = tradeProductConfig[productType];
  const id = config.idSuffix === "" ? underlying.id : `${underlying.id}-${config.idSuffix}`;
  const name = `${underlying.name} ${config.label}`;
  const location = underlying.location ?? "Global RWA Venue";
  const apy = underlying.apy ?? Number(Math.max(4, Math.min(18, Math.abs(underlying.change24h) + 1.5)).toFixed(1));
  const available = underlying.available ?? Math.max(12, Math.round(underlying.marketCap / 25_000_000));
  const totalValue = underlying.totalValue ?? Math.max(underlying.price * available * 100, underlying.marketCap * 0.015);
  const status = underlying.status ?? "active";

  return {
    id,
    underlyingId: underlying.id,
    productType,
    symbol: `${underlying.symbol}${config.symbolSuffix}`,
    name,
    type: underlying.type,
    price: roundTradePrice(underlying.price * config.priceMultiplier),
    change24h: Number((underlying.change24h + config.changeOffset).toFixed(2)),
    volume24h: Math.round(underlying.volume24h * config.volumeMultiplier),
    marketCap: Math.round(underlying.marketCap * config.marketCapMultiplier),
    leverage: config.leverage,
    description: `${config.descriptionPrefix}${underlying.description}`,
    image: getAssetArtwork(name, location, underlying.type),
    location,
    apy,
    available,
    totalValue,
    status,
  };
}

export const tradeInstruments: TradeInstrument[] = tradeUnderlyings.flatMap((underlying) =>
  (["spot", "futures", "index", "etf"] as const).map((productType) => createTradeInstrument(underlying, productType)),
);

export const portfolioPositions: PortfolioPosition[] = [
  { id: "nyc-pos", name: "SoHo Residential Trust", symbol: "NYC", type: "real-estate", amount: 1000, avgPrice: 0.0446, currentPrice: 0.04461, totalValue: 44.61, costBasis: 44.6, pnl: 0.01, pnlPercent: 0.02, allocation: 0.24 },
  { id: "gold-pos", name: "Vaulted Gold Reserve", symbol: "GOLD", type: "commodities", amount: 500, avgPrice: 33.5, currentPrice: 33.99, totalValue: 16995, costBasis: 16750, pnl: 245, pnlPercent: 1.46, allocation: 91.2 },
  { id: "silver-pos", name: "Strategic Silver Basket", symbol: "SILVER", type: "commodities", amount: 3000, avgPrice: 0.38, currentPrice: 0.3846, totalValue: 1153.8, costBasis: 1140, pnl: 13.8, pnlPercent: 1.21, allocation: 6.19 },
  { id: "art-pos", name: "Blue Chip Art Index", symbol: "ART", type: "art", amount: 100, avgPrice: 0.054, currentPrice: 0.05328, totalValue: 5.33, costBasis: 5.4, pnl: -0.07, pnlPercent: -1.3, allocation: 0.03 },
  { id: "bond-pos", name: "US Treasury Note ETF", symbol: "BOND", type: "bonds", amount: 1500, avgPrice: 0.23, currentPrice: 0.2323, totalValue: 348.45, costBasis: 345, pnl: 3.45, pnlPercent: 1, allocation: 1.87 },
];

export const transactionRecords: TransactionRecord[] = [
  { id: "tx-01", type: "buy", assetName: "SoHo Residential Trust", assetType: "real-estate", assetSymbol: "NYC", amount: 1000, price: 0.04461, total: 44.61, fee: 0.45, status: "completed", date: "2026-03-21", time: "14:32:15", txHash: "0x742d6b3f1e9a14d7c8f1296ab49a14db1a8c8f66" },
  { id: "tx-02", type: "buy", assetName: "Vaulted Gold Reserve", assetType: "commodities", assetSymbol: "GOLD", amount: 500, price: 33.99, total: 16995, fee: 169.95, status: "completed", date: "2026-03-20", time: "09:15:42", txHash: "0x8b9e7f6c3d2a11f54296ce31a6db0ed99f3ac782" },
  { id: "tx-03", type: "sell", assetName: "US Treasury Note ETF", assetType: "bonds", assetSymbol: "BOND", amount: 2000, price: 0.2323, total: 464.6, fee: 4.65, status: "completed", date: "2026-03-19", time: "16:45:30", txHash: "0x19f8a2c7b4f17d2865ac41b716d4ef0569a90173" },
  { id: "tx-04", type: "buy", assetName: "Blue Chip Art Index", assetType: "art", assetSymbol: "ART", amount: 100, price: 0.05328, total: 5.33, fee: 0.05, status: "pending", date: "2026-03-23", time: "15:20:10", txHash: "0x65de2b09fd4f1b34e7c11896bca14e05d9f33012" },
  { id: "tx-05", type: "buy", assetName: "Strategic Silver Basket", assetType: "commodities", assetSymbol: "SILVER", amount: 3000, price: 0.3846, total: 1153.8, fee: 11.54, status: "completed", date: "2026-03-18", time: "11:30:25", txHash: "0x27be9081ea6b4cf31d3f706a57c6712d6181aa10" },
  { id: "tx-06", type: "buy", assetName: "North America Defense Equity", assetType: "restricted", assetSymbol: "DEF", amount: 2, price: 5000000, total: 10000000, fee: 42000, status: "failed", date: "2026-03-16", time: "10:22:11", txHash: "0x91353dbf73ec61ae01f6b86cf8f783ab02d172a2" },
];

function createCatalogAsset(
  id: string,
  name: string,
  type: AssetType,
  location: string,
  price: number,
  apy: number,
  totalValue: number,
  available: number,
  status: CatalogAsset["status"],
  description: string,
): CatalogAsset {
  return { id, name, type, location, price, apy, totalValue, available, status, description, image: getAssetArtwork(name, location, type) };
}

export const catalogAssets: CatalogAsset[] = [
  createCatalogAsset("asset-01", "SoHo Residential Trust", "real-estate", "New York, United States", 250000, 8.5, 5000000, 15, "active", "Prime Manhattan rental inventory with predictable occupancy and income."),
  createCatalogAsset("asset-02", "Canary Wharf Office Tower", "real-estate", "London, United Kingdom", 350000, 7.8, 8000000, 8, "active", "Institutional-grade office exposure backed by long-term tenant contracts."),
  createCatalogAsset("asset-03", "Picasso Limited Print", "art", "Sotheby's Vault", 500000, 12.3, 2000000, 3, "active", "Blue-chip collectible with complete provenance and insured storage."),
  createCatalogAsset("asset-04", "US Treasury Note ETF", "bonds", "New York, United States", 10000, 5.2, 10000000, 850, "active", "AAA sovereign fixed-income allocation optimized for lower volatility."),
  createCatalogAsset("asset-05", "Vaulted Gold Reserve", "commodities", "Zurich Bullion Vault", 50000, 4.5, 15000000, 200, "active", "Fully custodied physical gold with low-friction token settlement."),
  createCatalogAsset("asset-06", "Silicon Valley Growth Equity", "equity", "California, United States", 100000, 25, 5000000, 40, "active", "Private AI-growth equity access with elevated upside and execution risk."),
  createCatalogAsset("asset-07", "Streaming Royalty Basket", "ip-royalties", "Spotify / Apple Music", 75000, 16.5, 3000000, 30, "active", "Music royalty flows diversified across streaming platforms and catalogs."),
  createCatalogAsset("asset-08", "Amazon Carbon Reserve", "carbon-credits", "Para, Brazil", 15000, 10.5, 4000000, 250, "active", "Verified carbon credits bundled with forestry registry and retirement metadata."),
  createCatalogAsset("asset-09", "Hermes Collection Note", "luxury-goods", "Paris, France", 90000, 13.5, 2000000, 18, "active", "Luxury collectible tranche with auction-backed market reference data."),
  createCatalogAsset("asset-10", "Palm Jumeirah Villa", "real-estate", "Dubai, United Arab Emirates", 800000, 9.2, 12000000, 5, "coming-soon", "High-end hospitality residence targeting global HNWI demand."),
  createCatalogAsset("asset-11", "North America Defense Equity", "restricted", "Washington, United States", 5000000, 15, 100000000, 5, "active", "Restricted strategic equity requiring enhanced investor accreditation and compliance review."),
  createCatalogAsset("asset-12", "Swiss Energy Infrastructure", "restricted", "Bern, Switzerland", 2000000, 8.5, 50000000, 10, "active", "Critical infrastructure exposure available only to higher-tier reviewed identities."),
];

function hashSeed(input: string) {
  return [...input].reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

export type ChartTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

interface ChartableAsset {
  id: string;
  price: number;
  volume24h: number;
}

export function createPriceSeries(asset: ChartableAsset, timeframe: ChartTimeframe) {
  const points = timeframe === "1d" ? 20 : timeframe === "4h" ? 24 : 28;
  const seed = hashSeed(`${asset.id}-${timeframe}`);

  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin((index + seed) / 2.8) * asset.price * 0.05;
    const drift = (index - points / 2) * asset.price * 0.003;
    const close = Number((asset.price + wave + drift).toFixed(asset.price < 1 ? 5 : 2));
    return {
      id: `${asset.id}-${timeframe}-${index}`,
      time: `${index + 1}`,
      close,
      volume: Math.round(asset.volume24h / points + (Math.cos(index + seed) + 1) * 12000),
    };
  });
}

export function createOrderBook(asset: Pick<TradeAssetQuote, "id" | "price">) {
  const seed = hashSeed(`${asset.id}-book`);
  const step = asset.price < 1 ? 0.0005 + (seed % 3) * 0.0001 : 0.45 + (seed % 4) * 0.15;

  const asks = Array.from({ length: 8 }, (_, index) => {
    const price = asset.price + (index + 1) * step;
    const amount = Number((3.2 + index * 0.71 + (seed % 5) * 0.08).toFixed(4));
    return { price, amount, total: Number((price * amount).toFixed(2)) };
  });

  const bids = Array.from({ length: 8 }, (_, index) => {
    const price = asset.price - (index + 1) * step;
    const amount = Number((4.1 + index * 0.58 + (seed % 7) * 0.05).toFixed(4));
    return { price, amount, total: Number((price * amount).toFixed(2)) };
  });

  return { asks: asks.reverse(), bids };
}

export function createRecentTrades(asset: Pick<TradeAssetQuote, "id" | "price">) {
  const seed = hashSeed(`${asset.id}-trades`);
  return Array.from({ length: 10 }, (_, index) => {
    const multiplier = index % 2 === 0 ? 1 : -1;
    const price = asset.price + multiplier * asset.price * (0.002 + index * 0.0006 + (seed % 3) * 0.0002);
    const amount = Number((0.6 + index * 0.22 + (seed % 4) * 0.03).toFixed(4));
    return {
      id: `${asset.id}-trade-${index}`,
      price: Number(price.toFixed(asset.price < 1 ? 5 : 2)),
      amount,
      time: `09:${String(index * 3).padStart(2, "0")}:12`,
      side: multiplier > 0 ? "buy" : "sell",
    };
  });
}
