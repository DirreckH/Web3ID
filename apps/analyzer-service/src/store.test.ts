import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile, rm, writeFile } from "node:fs/promises";
import { analyzerConfig } from "./config.js";
import { loadStore, saveStore } from "./store.js";

describe("analyzer store", () => {
  beforeEach(async () => {
    await rm(analyzerConfig.dataFile, { force: true });
  });

  afterEach(async () => {
    await rm(analyzerConfig.dataFile, { force: true });
  });

  it("serializes concurrent writes without corrupting persisted JSON", async () => {
    await Promise.all(
      Array.from({ length: 12 }, async (_item, index) => {
        const store = await loadStore();
        store.watchers = {
          [`watch-${index}`]: {
            watchId: `watch-${index}`,
            scope: "identity",
            identityId: `0x${(index + 1).toString(16).padStart(64, "0")}`,
            rootIdentityId: `0x${(index + 101).toString(16).padStart(64, "0")}`,
            recentBlocks: 32,
            pollIntervalMs: 15_000,
            status: "ACTIVE",
            createdAt: "2026-03-18T00:00:00.000Z",
            updatedAt: "2026-03-18T00:00:00.000Z",
            lastScanStartedAt: "2026-03-18T00:00:00.000Z",
            lastScanCompletedAt: "2026-03-18T00:00:01.000Z",
          },
        };
        store.events = {
          [`event-${index}`]: {
            eventId: `event-${index}`,
            chainId: 31337,
            txHash: `0x${(index + 1000).toString(16).padStart(64, "0")}`,
            txIndex: index,
            blockNumber: BigInt(index + 1),
            blockTimestamp: "2026-03-18T00:00:00.000Z",
            address: "0x0000000000000000000000000000000000000001",
            direction: "outgoing",
            rootIdentityId: `0x${(index + 101).toString(16).padStart(64, "0")}`,
            subIdentityId: `0x${(index + 1).toString(16).padStart(64, "0")}`,
            bindingId: `binding-${index}`,
            kind: "native_transfer",
            label: "Concurrent write smoke test",
            protocolTags: [],
            value: BigInt(index),
            rawRef: `chain:31337:tx:${index}`,
            evidenceRefs: [`tx:${index}`],
          },
        };
        await saveStore(store);
      }),
    );

    const raw = await readFile(analyzerConfig.dataFile, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();

    const reloaded = await loadStore();
    expect(Object.keys(reloaded.watchers)).toHaveLength(1);
    expect(Object.keys(reloaded.events)).toHaveLength(1);
    const [event] = Object.values(reloaded.events);
    expect(typeof event?.blockNumber).toBe("bigint");
    expect(typeof event?.value).toBe("bigint");
  });

  it("surfaces malformed persisted JSON instead of silently resetting the store", async () => {
    await writeFile(analyzerConfig.dataFile, "{\"watchers\":", "utf8");
    await expect(loadStore()).rejects.toThrow(`Failed to load analyzer store at ${analyzerConfig.dataFile}`);
  });
});
