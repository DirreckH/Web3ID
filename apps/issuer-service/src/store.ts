import { readFile, writeFile } from "node:fs/promises";
import type { CredentialBundle, CredentialStatus } from "@web3id/credential";
import type { RootIdentity, SubIdentity } from "@web3id/identity";
import type { IdentityStateContext } from "../../../packages/state/src/index.js";
import { issuerConfig } from "./config.js";

export type StoredCredentialRecord = {
  bundle: CredentialBundle;
  status: CredentialStatus;
  createdAt: string;
  revokedAt?: string;
  revokeReason?: string;
};

export type StoredIdentityRecord = {
  rootIdentity: RootIdentity;
  subIdentity: SubIdentity;
  context: IdentityStateContext;
  createdAt: string;
  updatedAt: string;
};

export type IssuerStore = {
  credentials: Record<string, StoredCredentialRecord>;
  identities: Record<string, StoredIdentityRecord>;
  roots: Record<string, { rootIdentity: RootIdentity; subIdentityIds: string[] }>;
};

const EMPTY_STORE: IssuerStore = {
  credentials: {},
  identities: {},
  roots: {},
};

export async function loadStore(): Promise<IssuerStore> {
  try {
    const raw = await readFile(issuerConfig.dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<IssuerStore>;
    return {
      credentials: parsed.credentials ?? {},
      identities: parsed.identities ?? {},
      roots: parsed.roots ?? {},
    };
  } catch {
    return EMPTY_STORE;
  }
}

export async function saveStore(store: IssuerStore) {
  await writeFile(issuerConfig.dataFile, JSON.stringify(store, null, 2), "utf8");
}
