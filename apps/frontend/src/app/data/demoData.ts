import { getAssetArtwork } from "../lib/assetArt";
import type { AssetType } from "../lib/assetMeta";

export interface MarketToken {
  id: string;
  symbol: string;
  name: string;
  type: Extract<AssetType, "real-estate" | "art" | "bonds" | "commodities">;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  leverage: string;
  description: string;
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

export const marketTokens: MarketToken[] = [
  { id: "nyc", symbol: "NYC", name: "SoHo Residential Trust", type: "real-estate", price: 0.04461, change24h: 8.46, volume24h: 142_330_000, marketCap: 450_000_000, leverage: "5x", description: "Fractional ownership of premium Manhattan apartments with stable rental cash flow." },
  { id: "gold", symbol: "GOLD", name: "Vaulted Gold Reserve", type: "commodities", price: 33.99, change24h: 7.87, volume24h: 6_581_400, marketCap: 890_000_000, leverage: "10x", description: "Swiss-custodied gold reserve exposure for inflation hedge strategies." },
  { id: "bond", symbol: "BOND", name: "US Treasury Note", type: "bonds", price: 0.2323, change24h: 8.4, volume24h: 7_967_600, marketCap: 1_200_000_000, leverage: "3x", description: "Short-duration treasury allocation for conservative yield-focused positioning." },
  { id: "art", symbol: "ART", name: "Blue Chip Art Index", type: "art", price: 0.05328, change24h: 8.01, volume24h: 11_507_500, marketCap: 230_000_000, leverage: "5x", description: "Basket of museum-grade art assets sourced from leading auction houses." },
  { id: "silver", symbol: "SILVER", name: "Strategic Silver Basket", type: "commodities", price: 0.3846, change24h: 6.95, volume24h: 1_118_300, marketCap: 120_000_000, leverage: "5x", description: "High-liquidity silver allocation with lower ticket access for diversified commodity exposure." },
  { id: "wine", symbol: "WINE", name: "Bordeaux Collection", type: "art", price: 0.0017, change24h: 5.59, volume24h: 373_938, marketCap: 45_000_000, leverage: "2x", description: "Fine wine cellar fractions combining collectible upside with stable demand." },
];

export const portfolioPositions: PortfolioPosition[] = [
  { id: "nyc-pos", name: "SoHo Residential Trust", symbol: "NYC", type: "real-estate", amount: 1000, avgPrice: 0.0446, currentPrice: 0.04461, totalValue: 44.61, costBasis: 44.6, pnl: 0.01, pnlPercent: 0.02, allocation: 0.24 },
  { id: "gold-pos", name: "Vaulted Gold Reserve", symbol: "GOLD", type: "commodities", amount: 500, avgPrice: 33.5, currentPrice: 33.99, totalValue: 16_995, costBasis: 16_750, pnl: 245, pnlPercent: 1.46, allocation: 91.2 },
  { id: "silver-pos", name: "Strategic Silver Basket", symbol: "SILVER", type: "commodities", amount: 3000, avgPrice: 0.38, currentPrice: 0.3846, totalValue: 1_153.8, costBasis: 1_140, pnl: 13.8, pnlPercent: 1.21, allocation: 6.19 },
  { id: "art-pos", name: "Blue Chip Art Index", symbol: "ART", type: "art", amount: 100, avgPrice: 0.054, currentPrice: 0.05328, totalValue: 5.33, costBasis: 5.4, pnl: -0.07, pnlPercent: -1.3, allocation: 0.03 },
  { id: "bond-pos", name: "US Treasury Note ETF", symbol: "BOND", type: "bonds", amount: 1500, avgPrice: 0.23, currentPrice: 0.2323, totalValue: 348.45, costBasis: 345, pnl: 3.45, pnlPercent: 1, allocation: 1.87 },
];

export const transactionRecords: TransactionRecord[] = [
  { id: "tx-01", type: "buy", assetName: "SoHo Residential Trust", assetType: "real-estate", assetSymbol: "NYC", amount: 1000, price: 0.04461, total: 44.61, fee: 0.45, status: "completed", date: "2026-03-21", time: "14:32:15", txHash: "0x742d6b3f1e9a14d7c8f1296ab49a14db1a8c8f66" },
  { id: "tx-02", type: "buy", assetName: "Vaulted Gold Reserve", assetType: "commodities", assetSymbol: "GOLD", amount: 500, price: 33.99, total: 16_995, fee: 169.95, status: "completed", date: "2026-03-20", time: "09:15:42", txHash: "0x8b9e7f6c3d2a11f54296ce31a6db0ed99f3ac782" },
  { id: "tx-03", type: "sell", assetName: "US Treasury Note ETF", assetType: "bonds", assetSymbol: "BOND", amount: 2000, price: 0.2323, total: 464.6, fee: 4.65, status: "completed", date: "2026-03-19", time: "16:45:30", txHash: "0x19f8a2c7b4f17d2865ac41b716d4ef0569a90173" },
  { id: "tx-04", type: "buy", assetName: "Blue Chip Art Index", assetType: "art", assetSymbol: "ART", amount: 100, price: 0.05328, total: 5.33, fee: 0.05, status: "pending", date: "2026-03-23", time: "15:20:10", txHash: "0x65de2b09fd4f1b34e7c11896bca14e05d9f33012" },
  { id: "tx-05", type: "buy", assetName: "Strategic Silver Basket", assetType: "commodities", assetSymbol: "SILVER", amount: 3000, price: 0.3846, total: 1_153.8, fee: 11.54, status: "completed", date: "2026-03-18", time: "11:30:25", txHash: "0x27be9081ea6b4cf31d3f706a57c6712d6181aa10" },
  { id: "tx-06", type: "buy", assetName: "North America Defense Equity", assetType: "restricted", assetSymbol: "DEF", amount: 2, price: 5_000_000, total: 10_000_000, fee: 42_000, status: "failed", date: "2026-03-16", time: "10:22:11", txHash: "0x91353dbf73ec61ae01f6b86cf8f783ab02d172a2" },
];

function createCatalogAsset(id: string, name: string, type: AssetType, location: string, price: number, apy: number, totalValue: number, available: number, status: CatalogAsset["status"], description: string): CatalogAsset {
  return { id, name, type, location, price, apy, totalValue, available, status, description, image: getAssetArtwork(name, location, type) };
}

export const catalogAssets: CatalogAsset[] = [
  createCatalogAsset("asset-01", "SoHo Residential Trust", "real-estate", "New York, United States", 250_000, 8.5, 5_000_000, 15, "active", "Prime Manhattan rental inventory with predictable occupancy and income."),
  createCatalogAsset("asset-02", "Canary Wharf Office Tower", "real-estate", "London, United Kingdom", 350_000, 7.8, 8_000_000, 8, "active", "Institutional-grade office exposure backed by long-term tenant contracts."),
  createCatalogAsset("asset-03", "Picasso Limited Print", "art", "Sotheby's Vault", 500_000, 12.3, 2_000_000, 3, "active", "Blue-chip collectible with complete provenance and insured storage."),
  createCatalogAsset("asset-04", "US Treasury Note ETF", "bonds", "New York, United States", 10_000, 5.2, 10_000_000, 850, "active", "AAA sovereign fixed-income allocation optimized for lower volatility."),
  createCatalogAsset("asset-05", "Vaulted Gold Reserve", "commodities", "Zurich Bullion Vault", 50_000, 4.5, 15_000_000, 200, "active", "Fully custodied physical gold with low-friction token settlement."),
  createCatalogAsset("asset-06", "Silicon Valley Growth Equity", "equity", "California, United States", 100_000, 25, 5_000_000, 40, "active", "Private AI-growth equity access with elevated upside and execution risk."),
  createCatalogAsset("asset-07", "Streaming Royalty Basket", "ip-royalties", "Spotify / Apple Music", 75_000, 16.5, 3_000_000, 30, "active", "Music royalty flows diversified across streaming platforms and catalogs."),
  createCatalogAsset("asset-08", "Amazon Carbon Reserve", "carbon-credits", "Para, Brazil", 15_000, 10.5, 4_000_000, 250, "active", "Verified carbon credits bundled with forestry registry and retirement metadata."),
  createCatalogAsset("asset-09", "Hermes Collection Note", "luxury-goods", "Paris, France", 90_000, 13.5, 2_000_000, 18, "active", "Luxury collectible tranche with auction-backed market reference data."),
  createCatalogAsset("asset-10", "Palm Jumeirah Villa", "real-estate", "Dubai, United Arab Emirates", 800_000, 9.2, 12_000_000, 5, "coming-soon", "High-end hospitality residence targeting global HNWI demand."),
  createCatalogAsset("asset-11", "North America Defense Equity", "restricted", "Washington, United States", 5_000_000, 15, 100_000_000, 5, "active", "Restricted strategic equity requiring enhanced investor accreditation and compliance review."),
  createCatalogAsset("asset-12", "Swiss Energy Infrastructure", "restricted", "Bern, Switzerland", 2_000_000, 8.5, 50_000_000, 10, "active", "Critical infrastructure exposure available only to higher-tier reviewed identities."),
];

function hashSeed(input: string) {
  return [...input].reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);
}

export function createPriceSeries(token: MarketToken, timeframe: "1m" | "5m" | "15m" | "1h" | "4h" | "1d") {
  const points = timeframe === "1d" ? 20 : timeframe === "4h" ? 24 : 28;
  const seed = hashSeed(`${token.id}-${timeframe}`);

  return Array.from({ length: points }, (_, index) => {
    const wave = Math.sin((index + seed) / 2.8) * token.price * 0.05;
    const drift = (index - points / 2) * token.price * 0.003;
    const close = Number((token.price + wave + drift).toFixed(token.price < 1 ? 5 : 2));
    return { id: `${token.id}-${timeframe}-${index}`, time: `${index + 1}`, close, volume: Math.round(token.volume24h / points + (Math.cos(index + seed) + 1) * 12_000) };
  });
}

export function createOrderBook(basePrice: number) {
  const asks = Array.from({ length: 8 }, (_, index) => {
    const price = basePrice + (index + 1) * (basePrice < 1 ? 0.0007 : 0.75);
    const amount = Number((3.2 + index * 0.71).toFixed(4));
    return { price, amount, total: Number((price * amount).toFixed(2)) };
  });

  const bids = Array.from({ length: 8 }, (_, index) => {
    const price = basePrice - (index + 1) * (basePrice < 1 ? 0.0007 : 0.75);
    const amount = Number((4.1 + index * 0.58).toFixed(4));
    return { price, amount, total: Number((price * amount).toFixed(2)) };
  });

  return { asks: asks.reverse(), bids };
}

export function createRecentTrades(token: MarketToken) {
  return Array.from({ length: 10 }, (_, index) => {
    const multiplier = index % 2 === 0 ? 1 : -1;
    const price = token.price + multiplier * token.price * (0.002 + index * 0.0006);
    const amount = Number((0.6 + index * 0.22).toFixed(4));
    return { id: `${token.id}-trade-${index}`, price: Number(price.toFixed(token.price < 1 ? 5 : 2)), amount, time: `09:${String(index * 3).padStart(2, "0")}:12`, side: multiplier > 0 ? "buy" : "sell" };
  });
}
