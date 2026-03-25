import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("data gateway", () => {
  it("returns mock data in mock mode", async () => {
    const { createDataGateway } = await import("../src/app/lib/dataGateway");
    const gateway = createDataGateway("mock");

    const assets = await gateway.listTradeInstruments();
    const positions = await gateway.listPortfolioPositions();
    const history = await gateway.listTransactionHistory();

    expect(assets.length).toBeGreaterThan(0);
    expect(positions.length).toBeGreaterThan(0);
    expect(history.length).toBeGreaterThan(0);
  });

  it("switches to api adapter and requests backend endpoints", async () => {
    vi.stubEnv("VITE_APP_ENV", "test");
    vi.stubEnv("VITE_DATA_SOURCE", "api");
    vi.stubEnv("VITE_API_BASE_URL", "https://api.example.com");

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            id: "nyc",
            symbol: "NYC",
            name: "SoHo Residential Trust",
            type: "real-estate",
            price: 0.04461,
            change24h: 8.46,
            volume24h: 142330000,
            marketCap: 450000000,
            leverage: "5x",
            description: "mock",
          },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { createDataGateway } = await import("../src/app/lib/dataGateway");
    const gateway = createDataGateway("api");

    const assets = await gateway.listTradeInstruments();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.example.com/trade/assets");
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe("GET");
    expect(assets[0]?.symbol).toBe("NYC");
  });
});
