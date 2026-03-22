import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ROOT_IDENTITY_SCHEMA_VERSION, normalizeControllerRef } from "../packages/identity/src/index.js";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

type BackfillStats = {
  rootsVisited: number;
  rootsUpdated: number;
  skipped: number;
};

function isObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function looksLikeRootIdentity(value: { [key: string]: JsonValue }) {
  return typeof value.rootId === "string" && typeof value.identityId === "string" && typeof value.didLikeId === "string";
}

function backfillNode(value: JsonValue, stats: BackfillStats): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => backfillNode(item, stats));
  }

  if (!isObject(value)) {
    return value;
  }

  const next = Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, backfillNode(nested, stats)]),
  ) as { [key: string]: JsonValue };

  if (!looksLikeRootIdentity(next)) {
    return next;
  }

  stats.rootsVisited += 1;

  const controllerAddress =
    typeof next.controllerAddress === "string"
      ? next.controllerAddress
      : typeof next.legacyControllerAddress === "string"
        ? next.legacyControllerAddress
        : null;
  const chainId =
    typeof next.chainId === "number"
      ? next.chainId
      : typeof next.chainId === "string" && next.chainId.trim()
        ? Number(next.chainId)
        : 31337;

  if (!controllerAddress || !Number.isFinite(chainId)) {
    stats.skipped += 1;
    return next;
  }

  const primaryControllerRef =
    isObject(next.primaryControllerRef) && typeof next.primaryControllerRef.didLikeId === "string"
      ? next.primaryControllerRef
      : normalizeControllerRef({
          chainFamily: "evm",
          networkId: chainId,
          address: controllerAddress,
        });

  const updated = {
    ...next,
    controllerAddress,
    legacyControllerAddress:
      typeof next.legacyControllerAddress === "string" ? next.legacyControllerAddress : controllerAddress,
    primaryControllerRef,
    schemaVersion:
      typeof next.schemaVersion === "string" && next.schemaVersion.trim()
        ? next.schemaVersion
        : ROOT_IDENTITY_SCHEMA_VERSION,
  } satisfies { [key: string]: JsonValue };

  const changed = JSON.stringify(updated) !== JSON.stringify(next);
  if (changed) {
    stats.rootsUpdated += 1;
  }

  return updated;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    throw new Error("Usage: pnpm exec tsx scripts/backfill-controller-refs.ts <path-to-json-store>");
  }

  const resolvedPath = resolve(process.cwd(), inputPath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw) as JsonValue;
  const stats: BackfillStats = {
    rootsVisited: 0,
    rootsUpdated: 0,
    skipped: 0,
  };

  const next = backfillNode(parsed, stats);
  await writeFile(resolvedPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  console.log(JSON.stringify({
    file: resolvedPath,
    ...stats,
    schemaVersion: ROOT_IDENTITY_SCHEMA_VERSION,
    autoCreatedSubjectAggregates: 0,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
