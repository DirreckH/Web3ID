import { readFile, writeFile } from "node:fs/promises";
import type { CredentialBundle, CredentialStatus } from "@web3id/credential";
import { issuerConfig } from "./config.js";

export type StoredCredentialRecord = {
  bundle: CredentialBundle;
  status: CredentialStatus;
  createdAt: string;
  revokedAt?: string;
  revokeReason?: string;
};

type IssuerStore = {
  credentials: Record<string, StoredCredentialRecord>;
};

const EMPTY_STORE: IssuerStore = { credentials: {} };

export async function loadStore(): Promise<IssuerStore> {
  try {
    const raw = await readFile(issuerConfig.dataFile, "utf8");
    return JSON.parse(raw) as IssuerStore;
  } catch {
    return EMPTY_STORE;
  }
}

export async function saveStore(store: IssuerStore) {
  await writeFile(issuerConfig.dataFile, JSON.stringify(store, null, 2), "utf8");
}
