import { Buffer } from "node:buffer";
import { Address as TonAddress, Cell, contractAddress, loadStateInit } from "@ton/core";
import { signVerify as tonSignVerify } from "@ton/crypto";
import { ed25519 } from "@noble/curves/ed25519.js";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { base58, bech32, bech32m } from "@scure/base";
import { Verifier as Bip322Verifier } from "bip322-js";
import * as bitcoinMessage from "bitcoinjs-message";
import { getAddress, recoverMessageAddress, keccak256, stringToHex, type Hex } from "viem";
import { buildProofEnvelopeSummary, parseControllerProofEnvelope } from "./controller-proof-envelope.js";
import {
  CONTROLLER_REF_VERSION,
  type ChainControllerRef,
  type ChainControllerRefInput,
  type ChainFamily,
  type ControllerCapabilityFlags,
  type ControllerChallengeLike,
  type ControllerChallengeFields,
  type ControllerProofEnvelope,
  type ControllerProofType,
  type ControllerSignatureScheme,
  type ControllerVerificationResult,
  type ControllerVerifierContext,
} from "./types.js";

export type ControllerNetworkPreset = {
  networkId: string;
  label: string;
  networkRef: string;
  mainnet: boolean;
  chainNamespace?: string;
  bech32Prefix?: string;
};

type ControllerProofVerificationOutput = {
  normalizedSigner: string;
  usedFallbackResolver: boolean;
  evidenceRefs: string[];
};

export type ControllerRegistryEntry = {
  family: ChainFamily;
  supportedNetworks: ControllerNetworkPreset[];
  didNamespace: string;
  defaultProofType: ControllerProofType;
  allowedProofTypes: ControllerProofType[];
  capabilityFlags: ControllerCapabilityFlags;
  normalizeControllerRef: (input: ChainControllerRefInput) => ChainControllerRef;
  buildDidLikeId: (controllerRef: Pick<ChainControllerRef, "networkId" | "normalizedAddress" | "chainNamespace">) => string;
  buildChallengeMessage: (fields: ControllerChallengeFields) => string;
  parseProofEnvelope: (input: unknown) => ControllerProofEnvelope;
  verifyProof: (input: {
    challenge: ControllerChallengeLike;
    proofEnvelope: ControllerProofEnvelope;
    context?: ControllerVerifierContext;
  }) => Promise<ControllerProofVerificationOutput>;
  verifierKind: string;
  verifierVersion: string;
  networkRef: (networkId: string) => string;
};

const DEFAULT_CAPABILITY_FLAGS: ControllerCapabilityFlags = {
  supportsAddressRecovery: false,
  requiresPublicKeyHint: false,
  supportsOfflineVerification: true,
  supportsRpcFallback: false,
  supportsStructuredProofPayload: false,
  reservedMultiSig: false,
};

const EVM_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "1", label: "Ethereum Mainnet", networkRef: "eip155:1", mainnet: true },
  { networkId: "42161", label: "Arbitrum One", networkRef: "eip155:42161", mainnet: true },
  { networkId: "8453", label: "Base", networkRef: "eip155:8453", mainnet: true },
  { networkId: "10", label: "OP Mainnet", networkRef: "eip155:10", mainnet: true },
];

const SOLANA_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "mainnet-beta", label: "Solana Mainnet Beta", networkRef: "solana:mainnet-beta", mainnet: true },
];

const BITCOIN_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "mainnet", label: "Bitcoin Mainnet", networkRef: "bip122:000000000019d6689c085ae165831e93", mainnet: true },
];

const TRON_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "mainnet", label: "TRON Mainnet", networkRef: "tron:mainnet", mainnet: true },
];

const TON_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "mainnet", label: "TON Mainnet", networkRef: "ton:mainnet", mainnet: true },
];

const COSMOS_NETWORKS: ControllerNetworkPreset[] = [
  {
    networkId: "kava_2222-10",
    label: "Kava Mainnet",
    networkRef: "cosmos:kava:kava_2222-10",
    mainnet: true,
    chainNamespace: "kava",
    bech32Prefix: "kava",
  },
  {
    networkId: "cosmoshub-4",
    label: "Cosmos Hub",
    networkRef: "cosmos:cosmoshub:cosmoshub-4",
    mainnet: true,
    chainNamespace: "cosmoshub",
    bech32Prefix: "cosmos",
  },
];

const APTOS_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "mainnet", label: "Aptos Mainnet", networkRef: "aptos:mainnet", mainnet: true },
];

const SUI_NETWORKS: ControllerNetworkPreset[] = [
  { networkId: "mainnet", label: "Sui Mainnet", networkRef: "sui:mainnet", mainnet: true },
];

function normalizeNetworkId(networkId: number | string) {
  const normalized = String(networkId).trim();
  if (!normalized) {
    throw new Error("Controller networkId is required.");
  }
  return normalized;
}

function ensureHexPrefix(value: string) {
  return value.startsWith("0x") ? value : `0x${value}`;
}

function bytesToHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

function hexToBytes(value: string) {
  const normalized = ensureHexPrefix(value);
  return Uint8Array.from(Buffer.from(normalized.slice(2), "hex"));
}

function decodeBinary(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return new Uint8Array();
  }
  if (trimmed.startsWith("0x")) {
    return hexToBytes(trimmed);
  }
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Uint8Array.from(Buffer.from(trimmed, "hex"));
  }
  return Uint8Array.from(Buffer.from(trimmed, "base64"));
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function assertBase58Address(input: string, expectedLength?: number) {
  try {
    const decoded = base58.decode(input);
    if (expectedLength !== undefined && decoded.length !== expectedLength) {
      throw new Error(`Expected ${expectedLength} bytes, received ${decoded.length}.`);
    }
  } catch (error) {
    throw new Error(`Invalid base58 address: ${error instanceof Error ? error.message : "decode failed"}`);
  }
}

function assertBitcoinAddress(input: string) {
  if (/^(bc1|tb1|bcrt1)/i.test(input)) {
    const lowered = input.toLowerCase();
    try {
      bech32.decode(lowered as `${string}1${string}`);
      return lowered;
    } catch {
      try {
        bech32m.decode(lowered as `${string}1${string}`);
        return lowered;
      } catch (error) {
        throw new Error(`Invalid bech32 bitcoin address: ${error instanceof Error ? error.message : "decode failed"}`);
      }
    }
  }

  assertBase58Address(input);
  return input;
}

function doubleSha256(bytes: Uint8Array) {
  return sha256(sha256(bytes));
}

function base58CheckEncode(bytes: Uint8Array) {
  const checksum = doubleSha256(bytes).slice(0, 4);
  const payload = new Uint8Array(bytes.length + checksum.length);
  payload.set(bytes, 0);
  payload.set(checksum, bytes.length);
  return base58.encode(payload);
}

function base58CheckDecode(input: string) {
  const decoded = base58.decode(input);
  if (decoded.length < 5) {
    throw new Error("Invalid base58check payload.");
  }
  const payload = decoded.slice(0, -4);
  const checksum = decoded.slice(-4);
  const expectedChecksum = doubleSha256(payload).slice(0, 4);
  if (!checksum.every((value, index) => value === expectedChecksum[index])) {
    throw new Error("Invalid base58check checksum.");
  }
  return payload;
}

function normalizeHexAddress32(value: string) {
  const normalized = ensureHexPrefix(value.trim()).toLowerCase();
  if (!/^0x[0-9a-f]{1,64}$/.test(normalized)) {
    throw new Error("Expected a 32-byte hex address.");
  }
  return `0x${normalized.slice(2).padStart(64, "0")}`;
}

function buildCanonicalChallengeMessage(fields: ControllerChallengeFields) {
  return [
    "Web3ID Controller Challenge",
    `domainTag: ${fields.domainTag}`,
    `challengeVersion: ${fields.challengeVersion}`,
    `bindingType: ${fields.bindingType}`,
    `chainFamily: ${fields.chainFamily}`,
    `networkId: ${fields.networkId}`,
    `normalizedAddress: ${fields.normalizedAddress}`,
    `proofType: ${fields.proofType}`,
    `rootIdentityId: ${fields.rootIdentityId}`,
    `subjectAggregateId: ${fields.subjectAggregateId}`,
    `nonce: ${fields.nonce}`,
    `issuedAt: ${fields.issuedAt}`,
    `expiresAt: ${fields.expiresAt}`,
    `replayScope: ${fields.replayScope}`,
  ].join("\n");
}

function resolvePreset(presets: ControllerNetworkPreset[], networkId: string) {
  return presets.find((preset) => preset.networkId === networkId);
}

function didLikeIdFromParts(namespace: string, controllerRef: Pick<ChainControllerRef, "networkId" | "normalizedAddress" | "chainNamespace">) {
  if (namespace === "cosmos") {
    return `did:pkh:cosmos:${controllerRef.chainNamespace}:${controllerRef.networkId}:${controllerRef.normalizedAddress}`;
  }
  return `did:pkh:${namespace}:${controllerRef.networkId}:${controllerRef.normalizedAddress}`;
}

function normalizeEvmControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const normalizedAddress = getAddress(input.address.trim());
  return {
    chainFamily: "evm",
    networkId,
    address: input.address.trim(),
    normalizedAddress,
    proofType: input.proofType ?? "eip191",
    publicKeyHint: input.publicKeyHint,
    chainId: typeof input.chainId === "number" ? input.chainId : Number(networkId),
    capabilityFlags: input.capabilityFlags ?? {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsAddressRecovery: true,
    },
    didLikeId: input.didLikeId ?? `did:pkh:eip155:${networkId}:${normalizedAddress}`,
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function normalizeSolanaControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const address = input.address.trim();
  assertBase58Address(address, 32);
  return {
    chainFamily: "solana",
    networkId,
    address,
    normalizedAddress: address,
    proofType: input.proofType ?? "solana_ed25519",
    publicKeyHint: input.publicKeyHint,
    capabilityFlags: input.capabilityFlags ?? DEFAULT_CAPABILITY_FLAGS,
    didLikeId: input.didLikeId ?? didLikeIdFromParts("solana", { networkId, normalizedAddress: address }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function normalizeBitcoinControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const normalizedAddress = assertBitcoinAddress(input.address.trim());
  return {
    chainFamily: "bitcoin",
    networkId,
    address: input.address.trim(),
    normalizedAddress,
    proofType: input.proofType ?? "bitcoin_bip322",
    publicKeyHint: input.publicKeyHint,
    capabilityFlags: input.capabilityFlags ?? DEFAULT_CAPABILITY_FLAGS,
    didLikeId: input.didLikeId ?? didLikeIdFromParts("bitcoin", { networkId, normalizedAddress }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function tronHexToBase58(input: string) {
  const normalized = ensureHexPrefix(input.trim()).toLowerCase();
  if (!/^0x41[0-9a-f]{40}$/.test(normalized)) {
    throw new Error("TRON hex addresses must be 21 bytes with a 0x41 prefix.");
  }
  return base58CheckEncode(hexToBytes(normalized));
}

function tronBase58ToBytes(input: string) {
  const payload = base58CheckDecode(input.trim());
  if (payload.length !== 21 || payload[0] !== 0x41) {
    throw new Error("TRON base58 payload must decode to 21 bytes with a 0x41 prefix.");
  }
  return payload;
}

function tronAddressFromPublicKey(publicKey: Uint8Array) {
  const uncompressed = publicKey[0] === 4 ? publicKey.slice(1) : publicKey;
  const hash = keccak256(`0x${bytesToHex(uncompressed)}` as Hex);
  return base58CheckEncode(hexToBytes(`0x41${hash.slice(-40)}`));
}

function normalizeTronControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const address = input.address.trim();
  const normalizedAddress =
    /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)
      ? base58CheckEncode(tronBase58ToBytes(address))
      : tronHexToBase58(address);
  return {
    chainFamily: "tron",
    networkId,
    address,
    normalizedAddress,
    proofType: input.proofType ?? "tron_signed_message_v2",
    publicKeyHint: input.publicKeyHint,
    capabilityFlags: input.capabilityFlags ?? {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsAddressRecovery: true,
    },
    didLikeId: input.didLikeId ?? didLikeIdFromParts("tron", { networkId, normalizedAddress }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function normalizeTonControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const parsed = TonAddress.parse(input.address.trim());
  const normalizedAddress = parsed.toString({
    bounceable: false,
    urlSafe: true,
    testOnly: networkId !== "mainnet",
  });
  return {
    chainFamily: "ton",
    networkId,
    address: input.address.trim(),
    normalizedAddress,
    proofType: input.proofType ?? "ton_proof_v2",
    publicKeyHint: input.publicKeyHint,
    walletStateInit: input.walletStateInit,
    workchain: input.workchain ?? parsed.workChain,
    capabilityFlags: input.capabilityFlags ?? {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsRpcFallback: true,
      supportsStructuredProofPayload: true,
    },
    didLikeId: input.didLikeId ?? didLikeIdFromParts("ton", { networkId, normalizedAddress }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function normalizeCosmosControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const address = input.address.trim().toLowerCase();
  const decoded = bech32.decode(address as `${string}1${string}`);
  const prefix = input.bech32Prefix ?? decoded.prefix;
  if (decoded.prefix !== prefix) {
    throw new Error(`Cosmos address prefix mismatch: expected ${prefix}, received ${decoded.prefix}.`);
  }
  const chainNamespace = input.chainNamespace ?? resolvePreset(COSMOS_NETWORKS, networkId)?.chainNamespace ?? prefix;
  const normalizedAddress = bech32.encode(prefix, decoded.words);
  return {
    chainFamily: "cosmos",
    networkId,
    address: input.address.trim(),
    normalizedAddress,
    proofType: input.proofType ?? "cosmos_adr036_direct",
    publicKeyHint: input.publicKeyHint,
    chainNamespace,
    bech32Prefix: prefix,
    capabilityFlags: input.capabilityFlags ?? {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsStructuredProofPayload: true,
    },
    didLikeId: input.didLikeId ?? didLikeIdFromParts("cosmos", { networkId, normalizedAddress, chainNamespace }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function normalizeAptosControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const normalizedAddress = normalizeHexAddress32(input.address);
  const parsedChainId = input.chainId === undefined ? undefined : Number(input.chainId);
  return {
    chainFamily: "aptos",
    networkId,
    address: input.address.trim(),
    normalizedAddress,
    proofType: input.proofType ?? "aptos_sign_message",
    publicKeyHint: input.publicKeyHint,
    chainId: Number.isFinite(parsedChainId) ? parsedChainId : undefined,
    capabilityFlags: input.capabilityFlags ?? {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsStructuredProofPayload: true,
    },
    didLikeId: input.didLikeId ?? didLikeIdFromParts("aptos", { networkId, normalizedAddress }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

function normalizeSuiControllerRef(input: ChainControllerRefInput): ChainControllerRef {
  const networkId = normalizeNetworkId(input.networkId);
  const normalizedAddress = normalizeHexAddress32(input.address);
  return {
    chainFamily: "sui",
    networkId,
    address: input.address.trim(),
    normalizedAddress,
    proofType: input.proofType ?? "sui_personal_message_ed25519",
    publicKeyHint: input.publicKeyHint,
    signatureScheme: input.signatureScheme,
    capabilityFlags: input.capabilityFlags ?? {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsStructuredProofPayload: true,
      reservedMultiSig: true,
    },
    didLikeId: input.didLikeId ?? didLikeIdFromParts("sui", { networkId, normalizedAddress }),
    controllerVersion: input.controllerVersion ?? CONTROLLER_REF_VERSION,
  };
}

async function verifyEvmProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  const recoveredSigner = await recoverMessageAddress({
    message: input.challenge.challengeMessage,
    signature: input.proofEnvelope.signature as Hex,
  });
  if (recoveredSigner.toLowerCase() !== input.challenge.controllerRef.normalizedAddress.toLowerCase()) {
    throw new Error("Controller signature does not match the normalized EVM address.");
  }
  return {
    normalizedSigner: recoveredSigner,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${recoveredSigner}`],
  };
}

function verifySolanaProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  const signature = decodeBinary(input.proofEnvelope.signature);
  const publicKey = base58.decode(input.challenge.controllerRef.normalizedAddress);
  const message = encodeUtf8(input.challenge.challengeMessage);
  if (!ed25519.verify(signature, message, publicKey)) {
    throw new Error("Solana controller signature is invalid.");
  }
  return {
    normalizedSigner: input.challenge.controllerRef.normalizedAddress,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${input.challenge.controllerRef.normalizedAddress}`],
  };
}

function verifyBitcoinProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  const verified =
    input.proofEnvelope.proofType === "bitcoin_legacy"
      ? bitcoinMessage.verify(input.challenge.challengeMessage, input.challenge.controllerRef.normalizedAddress, input.proofEnvelope.signature)
      : Bip322Verifier.verifySignature(input.challenge.controllerRef.normalizedAddress, input.challenge.challengeMessage, input.proofEnvelope.signature);
  if (!verified) {
    throw new Error("Bitcoin controller signature is invalid.");
  }
  return {
    normalizedSigner: input.challenge.controllerRef.normalizedAddress,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${input.challenge.controllerRef.normalizedAddress}`],
  };
}

function buildTronDigest(message: string) {
  const prefix = `\x19TRON Signed Message:\n${message.length}`;
  return keccak256(stringToHex(`${prefix}${message}`));
}

function verifyTronProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  const signatureBytes = decodeBinary(input.proofEnvelope.signature);
  if (signatureBytes.length !== 65) {
    throw new Error("TRON signatures must be 65 bytes long.");
  }
  const compactSignature =
    signatureBytes[0] <= 3 && signatureBytes[64] > 3
      ? signatureBytes.slice(1)
      : signatureBytes.slice(0, 64);
  const recoveryByte = signatureBytes[0] <= 3 && signatureBytes[64] > 3 ? signatureBytes[0] : signatureBytes[64];
  const recoveryBit = recoveryByte >= 27 ? recoveryByte - 27 : recoveryByte;
  if (recoveryBit !== 0 && recoveryBit !== 1) {
    throw new Error("TRON signatures must carry a valid recovery bit.");
  }
  const digest = hexToBytes(buildTronDigest(input.challenge.challengeMessage));
  const recovered = secp256k1.Signature.fromBytes(compactSignature, "compact")
    .addRecoveryBit(recoveryBit)
    .recoverPublicKey(digest)
    .toBytes(false);
  const normalizedSigner = tronAddressFromPublicKey(recovered);
  if (normalizedSigner !== input.challenge.controllerRef.normalizedAddress) {
    throw new Error("TRON controller signature does not match the normalized address.");
  }
  return {
    normalizedSigner,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${normalizedSigner}`],
  };
}

function buildTonProofSigningMessage(input: { address: string; domain: string; timestamp: number; payload: string }) {
  return [
    "ton-proof-item-v2/",
    input.address,
    input.domain,
    String(input.timestamp),
    input.payload,
  ].join("\n");
}

async function verifyTonProof(input: {
  challenge: ControllerChallengeLike;
  proofEnvelope: ControllerProofEnvelope;
  context?: ControllerVerifierContext;
}) {
  if (input.proofEnvelope.proofType !== "ton_proof_v2") {
    throw new Error("Unexpected TON proof envelope.");
  }
  const payload = input.proofEnvelope.proofPayload;
  if (payload.address !== input.challenge.controllerRef.normalizedAddress) {
    throw new Error("TON proof address does not match the normalized controller address.");
  }
  if (payload.payload !== input.challenge.challengeMessage) {
    throw new Error("TON proof payload does not match the canonical challenge message.");
  }
  const issuedAt = Math.floor(Date.parse(input.challenge.challengeFields?.issuedAt ?? input.challenge.createdAt) / 1000) * 1000;
  const expiresAt = Math.ceil(Date.parse(input.challenge.challengeFields?.expiresAt ?? input.challenge.expiresAt) / 1000) * 1000;
  const proofTime = payload.timestamp * 1000;
  if (proofTime < issuedAt || proofTime > expiresAt) {
    throw new Error("TON proof timestamp is outside the allowed challenge window.");
  }

  let usedFallbackResolver = false;
  let normalizedPublicKey = input.challenge.controllerRef.publicKeyHint;
  if (input.proofEnvelope.walletStateInit) {
    const stateInit = loadStateInit(Cell.fromBase64(input.proofEnvelope.walletStateInit).beginParse());
    const derivedAddress = contractAddress(input.challenge.controllerRef.workchain ?? 0, stateInit).toString({
      bounceable: false,
      urlSafe: true,
      testOnly: input.challenge.controllerRef.networkId !== "mainnet",
    });
    if (derivedAddress !== input.challenge.controllerRef.normalizedAddress) {
      throw new Error("TON walletStateInit does not derive the expected address.");
    }
  }
  if (!normalizedPublicKey && input.context?.tonResolvePublicKey) {
    normalizedPublicKey = await input.context.tonResolvePublicKey({
      controllerRef: input.challenge.controllerRef,
      walletStateInit: input.proofEnvelope.walletStateInit,
      publicKeyHint: input.challenge.controllerRef.publicKeyHint,
    });
    if (normalizedPublicKey) {
      usedFallbackResolver = true;
      input.context.onFallbackResolverUsed?.({
        chainFamily: "ton",
        networkId: input.challenge.controllerRef.networkId,
        normalizedAddress: input.challenge.controllerRef.normalizedAddress,
        resolver: "tonResolvePublicKey",
      });
    }
  }
  if (!normalizedPublicKey) {
    throw new Error("TON verification requires publicKeyHint or an injected resolver.");
  }
  const signature = decodeBinary(input.proofEnvelope.signature);
  const signingMessage = encodeUtf8(
    buildTonProofSigningMessage({
      address: payload.address,
      domain: payload.domain,
      timestamp: payload.timestamp,
      payload: payload.payload,
    }),
  );
  if (!tonSignVerify(Buffer.from(signingMessage), Buffer.from(signature), Buffer.from(hexToBytes(normalizedPublicKey)))) {
    throw new Error("TON proof signature is invalid.");
  }
  return {
    normalizedSigner: input.challenge.controllerRef.normalizedAddress,
    usedFallbackResolver,
    evidenceRefs: [
      `signer:${input.challenge.controllerRef.normalizedAddress}`,
      `ton-domain:${payload.domain}`,
    ],
  };
}

function cosmosAddressFromPublicKey(publicKey: Uint8Array, bech32Prefix: string) {
  const pubkeyHash = ripemd160(sha256(publicKey));
  return bech32.encode(bech32Prefix, bech32.toWords(pubkeyHash));
}

function verifyCosmosProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  if (
    input.proofEnvelope.proofType !== "cosmos_adr036_direct" &&
    input.proofEnvelope.proofType !== "cosmos_adr036_legacy_amino"
  ) {
    throw new Error("Unexpected Cosmos proof envelope.");
  }
  const payload = input.proofEnvelope.proofPayload;
  if (payload.chainId !== input.challenge.controllerRef.networkId) {
    throw new Error("Cosmos proof chainId does not match the controller networkId.");
  }
  if (payload.signerAddress !== input.challenge.controllerRef.normalizedAddress) {
    throw new Error("Cosmos proof signer address does not match the normalized controller address.");
  }
  if (payload.bech32Prefix !== input.challenge.controllerRef.bech32Prefix) {
    throw new Error("Cosmos proof bech32 prefix does not match the controller ref.");
  }
  const signedBytes = decodeBinary(payload.signedBytes);
  if (Buffer.from(signedBytes).toString("utf8") !== input.challenge.challengeMessage) {
    throw new Error("Cosmos signed bytes do not match the canonical challenge message.");
  }
  const publicKey = decodeBinary(input.proofEnvelope.publicKey);
  const signature = decodeBinary(input.proofEnvelope.signature);
  if (signature.length !== 64) {
    throw new Error("Cosmos signatures must be 64-byte compact secp256k1 signatures.");
  }
  const normalizedSigner = cosmosAddressFromPublicKey(publicKey, payload.bech32Prefix);
  if (normalizedSigner !== input.challenge.controllerRef.normalizedAddress) {
    throw new Error("Cosmos proof public key does not derive the normalized controller address.");
  }
  const digest = sha256(signedBytes);
  if (!secp256k1.verify(signature, digest, publicKey, { prehash: false })) {
    throw new Error("Cosmos controller signature is invalid.");
  }
  return {
    normalizedSigner,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${normalizedSigner}`],
  };
}

function aptosAddressFromPublicKey(publicKey: Uint8Array) {
  const digest = sha3_256(new Uint8Array([...publicKey, 0x00]));
  return `0x${bytesToHex(digest).padStart(64, "0")}`;
}

function verifyAptosProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  if (input.proofEnvelope.proofType !== "aptos_sign_message" && input.proofEnvelope.proofType !== "aptos_siwa") {
    throw new Error("Unexpected Aptos proof envelope.");
  }
  const payload = input.proofEnvelope.proofPayload;
  if (payload.address.toLowerCase() !== input.challenge.controllerRef.normalizedAddress.toLowerCase()) {
    throw new Error("Aptos proof address does not match the normalized controller address.");
  }
  if (payload.message !== input.challenge.challengeMessage) {
    throw new Error("Aptos proof message does not match the canonical challenge message.");
  }
  const expectedChainId = input.challenge.controllerRef.chainId;
  if (expectedChainId !== undefined && payload.chainId !== expectedChainId) {
    throw new Error("Aptos proof chainId does not match the controller ref.");
  }
  const publicKey = decodeBinary(input.proofEnvelope.publicKey ?? input.challenge.controllerRef.publicKeyHint ?? "");
  if (publicKey.length === 0) {
    throw new Error("Aptos verification requires a public key.");
  }
  const signature = decodeBinary(input.proofEnvelope.signature);
  const normalizedSigner = aptosAddressFromPublicKey(publicKey);
  if (normalizedSigner.toLowerCase() !== input.challenge.controllerRef.normalizedAddress.toLowerCase()) {
    throw new Error("Aptos proof public key does not derive the normalized controller address.");
  }
  if (!ed25519.verify(signature, encodeUtf8(input.proofEnvelope.fullMessage!), publicKey)) {
    throw new Error("Aptos controller signature is invalid.");
  }
  return {
    normalizedSigner,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${normalizedSigner}`],
  };
}

function suiSchemeFlag(proofType: ControllerProofType | ControllerSignatureScheme) {
  switch (proofType) {
    case "sui_personal_message_ed25519":
    case "ed25519":
      return { flag: 0x00, scheme: "ed25519" as const };
    case "sui_personal_message_secp256k1":
    case "secp256k1":
      return { flag: 0x01, scheme: "secp256k1" as const };
    case "sui_personal_message_secp256r1":
    case "secp256r1":
      return { flag: 0x02, scheme: "secp256r1" as const };
    default:
      throw new Error(`Unsupported Sui signature scheme: ${proofType}`);
  }
}

function suiAddressFromPublicKey(publicKey: Uint8Array, proofType: ControllerProofType | ControllerSignatureScheme) {
  const { flag } = suiSchemeFlag(proofType);
  const digest = blake2b(new Uint8Array([flag, ...publicKey]), { dkLen: 32 });
  return `0x${bytesToHex(digest)}`;
}

function verifySuiProof(input: { challenge: ControllerChallengeLike; proofEnvelope: ControllerProofEnvelope }) {
  if (
    input.proofEnvelope.proofType !== "sui_personal_message_ed25519" &&
    input.proofEnvelope.proofType !== "sui_personal_message_secp256k1" &&
    input.proofEnvelope.proofType !== "sui_personal_message_secp256r1"
  ) {
    throw new Error("Unexpected Sui proof envelope.");
  }
  const payload = input.proofEnvelope.proofPayload;
  if (payload.address.toLowerCase() !== input.challenge.controllerRef.normalizedAddress.toLowerCase()) {
    throw new Error("Sui proof address does not match the normalized controller address.");
  }
  const messageBytes = decodeBinary(payload.messageBytes);
  if (Buffer.from(messageBytes).toString("utf8") !== input.challenge.challengeMessage) {
    throw new Error("Sui personal message does not match the canonical challenge message.");
  }
  const publicKey = decodeBinary(input.proofEnvelope.publicKey);
  const signature = decodeBinary(input.proofEnvelope.signature);
  const normalizedSigner = suiAddressFromPublicKey(publicKey, input.proofEnvelope.proofType);
  if (normalizedSigner.toLowerCase() !== input.challenge.controllerRef.normalizedAddress.toLowerCase()) {
    throw new Error("Sui proof public key does not derive the normalized controller address.");
  }
  const verified =
    input.proofEnvelope.proofType === "sui_personal_message_ed25519"
      ? ed25519.verify(signature, messageBytes, publicKey)
      : input.proofEnvelope.proofType === "sui_personal_message_secp256k1"
        ? secp256k1.verify(signature, blake2b(messageBytes, { dkLen: 32 }), publicKey, { prehash: false })
        : p256.verify(signature, blake2b(messageBytes, { dkLen: 32 }), publicKey, { prehash: false });
  if (!verified) {
    throw new Error("Sui controller signature is invalid.");
  }
  return {
    normalizedSigner,
    usedFallbackResolver: false,
    evidenceRefs: [`signer:${normalizedSigner}`],
  };
}

const controllerRegistryEntries: ControllerRegistryEntry[] = [
  {
    family: "evm",
    supportedNetworks: EVM_NETWORKS,
    didNamespace: "eip155",
    defaultProofType: "eip191",
    allowedProofTypes: ["eip191"],
    capabilityFlags: {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsAddressRecovery: true,
    },
    normalizeControllerRef: normalizeEvmControllerRef,
    buildDidLikeId: (controllerRef) => `did:pkh:eip155:${controllerRef.networkId}:${controllerRef.normalizedAddress}`,
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: verifyEvmProof,
    verifierKind: "recover_message_address",
    verifierVersion: "evm-eip191-v1",
    networkRef: (networkId) => resolvePreset(EVM_NETWORKS, networkId)?.networkRef ?? `eip155:${networkId}`,
  },
  {
    family: "solana",
    supportedNetworks: SOLANA_NETWORKS,
    didNamespace: "solana",
    defaultProofType: "solana_ed25519",
    allowedProofTypes: ["solana_ed25519"],
    capabilityFlags: DEFAULT_CAPABILITY_FLAGS,
    normalizeControllerRef: normalizeSolanaControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("solana", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: async (input) => verifySolanaProof(input),
    verifierKind: "ed25519_verify",
    verifierVersion: "solana-ed25519-v1",
    networkRef: (networkId) => resolvePreset(SOLANA_NETWORKS, networkId)?.networkRef ?? `solana:${networkId}`,
  },
  {
    family: "bitcoin",
    supportedNetworks: BITCOIN_NETWORKS,
    didNamespace: "bitcoin",
    defaultProofType: "bitcoin_bip322",
    allowedProofTypes: ["bitcoin_bip322", "bitcoin_legacy"],
    capabilityFlags: DEFAULT_CAPABILITY_FLAGS,
    normalizeControllerRef: normalizeBitcoinControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("bitcoin", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: async (input) => verifyBitcoinProof(input),
    verifierKind: "bitcoin_message_verify",
    verifierVersion: "bitcoin-message-v1",
    networkRef: (networkId) => resolvePreset(BITCOIN_NETWORKS, networkId)?.networkRef ?? `bitcoin:${networkId}`,
  },
  {
    family: "tron",
    supportedNetworks: TRON_NETWORKS,
    didNamespace: "tron",
    defaultProofType: "tron_signed_message_v2",
    allowedProofTypes: ["tron_signed_message_v2"],
    capabilityFlags: {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsAddressRecovery: true,
    },
    normalizeControllerRef: normalizeTronControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("tron", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: async (input) => verifyTronProof(input),
    verifierKind: "tron_signed_message_v2",
    verifierVersion: "tron-v2-v1",
    networkRef: (networkId) => resolvePreset(TRON_NETWORKS, networkId)?.networkRef ?? `tron:${networkId}`,
  },
  {
    family: "ton",
    supportedNetworks: TON_NETWORKS,
    didNamespace: "ton",
    defaultProofType: "ton_proof_v2",
    allowedProofTypes: ["ton_proof_v2"],
    capabilityFlags: {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsRpcFallback: true,
      supportsStructuredProofPayload: true,
    },
    normalizeControllerRef: normalizeTonControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("ton", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: verifyTonProof,
    verifierKind: "ton_proof_v2",
    verifierVersion: "ton-proof-v1",
    networkRef: (networkId) => resolvePreset(TON_NETWORKS, networkId)?.networkRef ?? `ton:${networkId}`,
  },
  {
    family: "cosmos",
    supportedNetworks: COSMOS_NETWORKS,
    didNamespace: "cosmos",
    defaultProofType: "cosmos_adr036_direct",
    allowedProofTypes: ["cosmos_adr036_direct", "cosmos_adr036_legacy_amino"],
    capabilityFlags: {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsStructuredProofPayload: true,
    },
    normalizeControllerRef: normalizeCosmosControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("cosmos", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: async (input) => verifyCosmosProof(input),
    verifierKind: "cosmos_adr036",
    verifierVersion: "cosmos-adr036-v1",
    networkRef: (networkId) => resolvePreset(COSMOS_NETWORKS, networkId)?.networkRef ?? `cosmos:${networkId}`,
  },
  {
    family: "aptos",
    supportedNetworks: APTOS_NETWORKS,
    didNamespace: "aptos",
    defaultProofType: "aptos_sign_message",
    allowedProofTypes: ["aptos_sign_message", "aptos_siwa"],
    capabilityFlags: {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsStructuredProofPayload: true,
    },
    normalizeControllerRef: normalizeAptosControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("aptos", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: async (input) => verifyAptosProof(input),
    verifierKind: "aptos_sign_message",
    verifierVersion: "aptos-v1",
    networkRef: (networkId) => resolvePreset(APTOS_NETWORKS, networkId)?.networkRef ?? `aptos:${networkId}`,
  },
  {
    family: "sui",
    supportedNetworks: SUI_NETWORKS,
    didNamespace: "sui",
    defaultProofType: "sui_personal_message_ed25519",
    allowedProofTypes: [
      "sui_personal_message_ed25519",
      "sui_personal_message_secp256k1",
      "sui_personal_message_secp256r1",
    ],
    capabilityFlags: {
      ...DEFAULT_CAPABILITY_FLAGS,
      supportsStructuredProofPayload: true,
      reservedMultiSig: true,
    },
    normalizeControllerRef: normalizeSuiControllerRef,
    buildDidLikeId: (controllerRef) => didLikeIdFromParts("sui", controllerRef),
    buildChallengeMessage: buildCanonicalChallengeMessage,
    parseProofEnvelope: parseControllerProofEnvelope,
    verifyProof: async (input) => verifySuiProof(input),
    verifierKind: "sui_personal_message",
    verifierVersion: "sui-v1",
    networkRef: (networkId) => resolvePreset(SUI_NETWORKS, networkId)?.networkRef ?? `sui:${networkId}`,
  },
];

export const controllerRegistry = Object.fromEntries(
  controllerRegistryEntries.map((entry) => [entry.family, entry]),
) as Record<ChainFamily, ControllerRegistryEntry>;

export function listSupportedChainFamilies() {
  return controllerRegistryEntries.map((entry) => entry.family);
}

export function listSupportedNetworks(family: ChainFamily) {
  return controllerRegistry[family].supportedNetworks;
}

export function listSupportedEvmNetworks() {
  return EVM_NETWORKS;
}

export function resolveEvmNetworkPreset(networkId: number | string) {
  const normalizedNetworkId = normalizeNetworkId(networkId);
  return resolvePreset(EVM_NETWORKS, normalizedNetworkId) ?? null;
}

export function getControllerRegistryEntry(family: ChainFamily) {
  return controllerRegistry[family];
}

export async function verifyControllerProof(input: {
  challenge: ControllerChallengeLike;
  proofEnvelope: ControllerProofEnvelope;
  context?: ControllerVerifierContext;
}): Promise<Omit<ControllerVerificationResult, "derivedRootIdentity" | "proofHash" | "challengeDigest">> {
  const registryEntry = getControllerRegistryEntry(input.challenge.controllerRef.chainFamily);
  const proofEnvelope = registryEntry.parseProofEnvelope(input.proofEnvelope);
  if (!registryEntry.allowedProofTypes.includes(proofEnvelope.proofType)) {
    throw new Error(`Proof type ${proofEnvelope.proofType} is not supported for ${input.challenge.controllerRef.chainFamily}.`);
  }
  if (proofEnvelope.proofType !== input.challenge.controllerRef.proofType) {
    throw new Error("Proof type does not match the controllerRef proofType.");
  }
  const verification = await registryEntry.verifyProof({
    challenge: input.challenge,
    proofEnvelope,
    context: input.context,
  });
  return {
    normalizedSigner: verification.normalizedSigner,
    verifierKind: registryEntry.verifierKind,
    verifierVersion: registryEntry.verifierVersion,
    proofEnvelope,
    proofEnvelopeSummary: buildProofEnvelopeSummary(proofEnvelope),
    usedFallbackResolver: verification.usedFallbackResolver,
    evidenceRefs: verification.evidenceRefs,
  };
}
