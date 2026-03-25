import { appEnvConfig, type DataSourceMode } from "../config/env";
import {
  catalogAssets,
  marketTokens,
  portfolioPositions,
  transactionRecords,
  type CatalogAsset,
  type MarketToken,
  type PortfolioPosition,
  type TransactionRecord,
} from "../data/demoData";
import { apiClient } from "./apiClient";

export type TradeInstrument = MarketToken;
export type PortfolioHolding = PortfolioPosition;
export type HistoryRecord = TransactionRecord;
export type CatalogAssetView = CatalogAsset;

export interface PurchaseStatus {
  verdict: "approved" | "review" | "restricted";
  reason: string;
  nextStep: string;
}

export interface PurchaseRequest {
  assetId: string;
  quantity: number;
}

export interface PurchaseResponse {
  status: "accepted" | "queued" | "blocked";
  verdict: PurchaseStatus["verdict"];
  ticketId: string;
}

export interface TradeDataGateway {
  listTradeInstruments(): Promise<MarketToken[]>;
  getTradeInstrument(id: string): Promise<MarketToken | null>;
  listCatalogAssets(): Promise<CatalogAsset[]>;
  getCatalogAsset(id: string): Promise<CatalogAsset | null>;
  getPurchaseStatus(assetId: string): Promise<PurchaseStatus>;
  submitPurchase(request: PurchaseRequest): Promise<PurchaseResponse>;
}

export interface PortfolioDataGateway {
  listPortfolioPositions(): Promise<PortfolioPosition[]>;
}

export interface HistoryDataGateway {
  listTransactionHistory(): Promise<TransactionRecord[]>;
}

type AppDataGateway = TradeDataGateway & PortfolioDataGateway & HistoryDataGateway;

function cloneArray<T extends object>(items: T[]) {
  return items.map((item) => ({ ...item }));
}

function resolvePurchaseStatusByType(type: string): PurchaseStatus {
  if (type === "restricted") {
    return {
      verdict: "restricted",
      reason: "This asset is restricted by eligibility policy.",
      nextStep: "Review restriction details and credential requirements.",
    };
  }

  if (["equity", "ip-royalties", "luxury-goods", "carbon-credits"].includes(type)) {
    return {
      verdict: "review",
      reason: "This asset requires additional manual compliance review.",
      nextStep: "Submit purchase to compliance queue.",
    };
  }

  return {
    verdict: "approved",
    reason: "Identity and compliance checks passed.",
    nextStep: "Proceed to on-chain execution.",
  };
}

const mockGateway: AppDataGateway = {
  async listTradeInstruments() {
    return cloneArray(marketTokens);
  },
  async getTradeInstrument(id) {
    const instrument = marketTokens.find((entry) => entry.id === id);
    return instrument ? { ...instrument } : null;
  },
  async listCatalogAssets() {
    return cloneArray(catalogAssets);
  },
  async getCatalogAsset(id) {
    const asset = catalogAssets.find((entry) => entry.id === id);
    return asset ? { ...asset } : null;
  },
  async listPortfolioPositions() {
    return cloneArray(portfolioPositions);
  },
  async listTransactionHistory() {
    return cloneArray(transactionRecords);
  },
  async getPurchaseStatus(assetId) {
    const catalog = catalogAssets.find((entry) => entry.id === assetId);
    const tradeAsset = marketTokens.find((entry) => entry.id === assetId);
    const assetType = catalog?.type ?? tradeAsset?.type ?? "restricted";

    return resolvePurchaseStatusByType(assetType);
  },
  async submitPurchase(request) {
    const purchaseStatus = await this.getPurchaseStatus(request.assetId);
    const status =
      purchaseStatus.verdict === "approved"
        ? "accepted"
        : purchaseStatus.verdict === "review"
          ? "queued"
          : "blocked";

    return {
      status,
      verdict: purchaseStatus.verdict,
      ticketId: `mock-${Date.now()}-${request.assetId}`,
    };
  },
};

const apiGateway: AppDataGateway = {
  async listTradeInstruments() {
    return apiClient.get<MarketToken[]>("/trade/assets");
  },
  async getTradeInstrument(id) {
    return apiClient.get<MarketToken | null>(`/trade/assets/${id}`);
  },
  async listCatalogAssets() {
    return apiClient.get<CatalogAsset[]>("/assets");
  },
  async getCatalogAsset(id) {
    return apiClient.get<CatalogAsset | null>(`/assets/${id}`);
  },
  async listPortfolioPositions() {
    return apiClient.get<PortfolioPosition[]>("/portfolio/positions");
  },
  async listTransactionHistory() {
    return apiClient.get<TransactionRecord[]>("/history/transactions");
  },
  async getPurchaseStatus(assetId) {
    return apiClient.get<PurchaseStatus>(`/purchases/status/${assetId}`);
  },
  async submitPurchase(request) {
    return apiClient.post<PurchaseResponse>("/purchases", request);
  },
};

const adapters: Record<DataSourceMode, AppDataGateway> = {
  mock: mockGateway,
  api: apiGateway,
};

export function createDataGateway(mode: DataSourceMode = appEnvConfig.dataSource): AppDataGateway {
  return adapters[mode];
}

const dataGateway = createDataGateway();

export function listTradeInstruments() {
  return dataGateway.listTradeInstruments();
}

export function getTradeInstrument(id: string) {
  return dataGateway.getTradeInstrument(id);
}

export function listCatalogAssets() {
  return dataGateway.listCatalogAssets();
}

export function getCatalogAsset(id: string) {
  return dataGateway.getCatalogAsset(id);
}

export function listPortfolioPositions() {
  return dataGateway.listPortfolioPositions();
}

export function listTransactionHistory() {
  return dataGateway.listTransactionHistory();
}

export function getPurchaseStatus(assetId: string) {
  return dataGateway.getPurchaseStatus(assetId);
}

export function submitPurchase(request: PurchaseRequest) {
  return dataGateway.submitPurchase(request);
}
