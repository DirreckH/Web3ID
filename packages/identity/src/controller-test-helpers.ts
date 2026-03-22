import { Buffer } from "node:buffer";
import { ed25519 } from "@noble/curves/ed25519.js";
import { p256 } from "@noble/curves/nist.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { ripemd160 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { sha3_256 } from "@noble/hashes/sha3.js";
import { base58, bech32 } from "@scure/base";
import { getAddress, keccak256, stringToHex } from "viem";
import { buildControllerChallengeFields, buildControllerChallengeMessage, normalizeControllerRef } from "./controller.js";
import { CONTROLLER_PROOF_ENVELOPE_VERSION, type ChainControllerRefInput, type ControllerChallengeLike, type ControllerProofEnvelope } from "./types.js";

function bytesToHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

function hexToBytes(value: string) {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  return Uint8Array.from(Buffer.from(normalized, "hex"));
}

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function parseChallengeField(message: string, key: string) {
  const prefix = `${key}: `;
  return message
    .split("\n")
    .find((line) => line.startsWith(prefix))
    ?.slice(prefix.length);
}

function base58CheckEncode(bytes: Uint8Array) {
  const checksum = sha256(sha256(bytes)).slice(0, 4);
  return base58.encode(new Uint8Array([...bytes, ...checksum]));
}

function tronDigest(message: string) {
  return hexToBytes(keccak256(stringToHex(`\x19TRON Signed Message:\n${message.length}${message}`)));
}

function cosmosAddressFromPublicKey(publicKey: Uint8Array, bech32Prefix: string) {
  return bech32.encode(bech32Prefix, bech32.toWords(ripemd160(sha256(publicKey))));
}

function aptosAddressFromPublicKey(publicKey: Uint8Array) {
  return `0x${bytesToHex(sha3_256(new Uint8Array([...publicKey, 0x00]))).padStart(64, "0")}`;
}

function suiAddressFromPublicKey(publicKey: Uint8Array, flag: number) {
  return `0x${bytesToHex(blake2b(new Uint8Array([flag, ...publicKey]), { dkLen: 32 }))}`;
}

export function createControllerChallengeFixture(input: {
  controllerRef: ChainControllerRefInput;
  bindingType?: "root_controller" | "subject_aggregate_link";
  rootIdentityId?: string;
  subjectAggregateId?: string;
  nonce?: string;
  issuedAt?: string;
  expiresAt?: string;
}): ControllerChallengeLike {
  const controllerRef = normalizeControllerRef(input.controllerRef);
  const issuedAt = input.issuedAt ?? "2030-03-22T00:00:00.000Z";
  const expiresAt = input.expiresAt ?? "2030-03-22T00:10:00.000Z";
  const fields = buildControllerChallengeFields({
    bindingType: input.bindingType ?? "root_controller",
    controllerRef,
    rootIdentityId: input.rootIdentityId,
    subjectAggregateId: input.subjectAggregateId,
    nonce: input.nonce ?? "fixture-nonce",
    issuedAt,
    expiresAt,
  });
  const challengeMessage = buildControllerChallengeMessage(fields);
  return {
    challengeHash: keccak256(stringToHex(challengeMessage)),
    challengeMessage,
    challengeFields: fields,
    controllerRef,
    replayKey: keccak256(stringToHex(`${fields.replayScope}:${fields.nonce}`)),
    createdAt: issuedAt,
    expiresAt,
    rootIdentityId: input.rootIdentityId as `0x${string}` | undefined,
    subjectAggregateId: input.subjectAggregateId,
  };
}

export function createTronFixture(secretKeyHex: string) {
  const secretKey = hexToBytes(secretKeyHex);
  const publicKey = secp256k1.getPublicKey(secretKey, false);
  const evmAddress = getAddress(`0x${keccak256(`0x${bytesToHex(publicKey.slice(1))}`).slice(-40)}`);
  const tronHex = `0x41${evmAddress.slice(2)}`;
  const controllerRef = normalizeControllerRef({
    chainFamily: "tron",
    networkId: "mainnet",
    address: tronHex,
  });
  return {
    secretKey,
    controllerRef,
    signChallenge(message: string): ControllerProofEnvelope {
      const signature = secp256k1.sign(tronDigest(message), secretKey, { prehash: false, format: "recovered" });
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "tron_signed_message_v2",
        signature: `0x${bytesToHex(signature)}`,
      };
    },
  };
}

export function createTonFixture(secretKeyHex: string, address = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c") {
  const secretKey = hexToBytes(secretKeyHex);
  const publicKey = ed25519.getPublicKey(secretKey);
  const controllerRef = normalizeControllerRef({
    chainFamily: "ton",
    networkId: "mainnet",
    address,
    publicKeyHint: `0x${bytesToHex(publicKey)}`,
  });
  return {
    secretKey,
    publicKey,
    controllerRef,
    signChallenge(message: string, timestamp?: number): ControllerProofEnvelope {
      const domain = "web3id.local";
      const resolvedTimestamp = timestamp ?? Math.floor(Date.parse(parseChallengeField(message, "issuedAt") ?? "1970-01-01T00:00:00.000Z") / 1000);
      const signingMessage = encodeUtf8(["ton-proof-item-v2/", controllerRef.normalizedAddress, domain, String(resolvedTimestamp), message].join("\n"));
      const signature = ed25519.sign(signingMessage, secretKey);
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "ton_proof_v2",
        signature: `0x${bytesToHex(signature)}`,
        proofPayload: {
          domain,
          payload: message,
          timestamp: resolvedTimestamp,
          address: controllerRef.normalizedAddress,
        },
      };
    },
  };
}

export function createCosmosFixture(secretKeyHex: string, networkId = "kava_2222-10", bech32Prefix = "kava") {
  const secretKey = hexToBytes(secretKeyHex);
  const publicKey = secp256k1.getPublicKey(secretKey, true);
  const address = cosmosAddressFromPublicKey(publicKey, bech32Prefix);
  const controllerRef = normalizeControllerRef({
    chainFamily: "cosmos",
    networkId,
    address,
    bech32Prefix,
    chainNamespace: "kava",
  });
  return {
    secretKey,
    publicKey,
    controllerRef,
    signDirect(message: string): ControllerProofEnvelope {
      const signedBytes = encodeUtf8(message);
      const signature = secp256k1.sign(sha256(signedBytes), secretKey, { prehash: false, format: "compact" });
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "cosmos_adr036_direct",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(publicKey)}`,
        proofPayload: {
          signMode: "direct",
          signerAddress: controllerRef.normalizedAddress,
          chainId: networkId,
          signDoc: JSON.stringify({ type: "sign/MsgSignData", value: { signer: controllerRef.normalizedAddress } }),
          signedBytes: `0x${bytesToHex(signedBytes)}`,
          bech32Prefix,
        },
      };
    },
    signLegacy(message: string): ControllerProofEnvelope {
      const signedBytes = encodeUtf8(message);
      const signature = secp256k1.sign(sha256(signedBytes), secretKey, { prehash: false, format: "compact" });
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "cosmos_adr036_legacy_amino",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(publicKey)}`,
        proofPayload: {
          signMode: "legacy_amino",
          signerAddress: controllerRef.normalizedAddress,
          chainId: networkId,
          signDoc: JSON.stringify({ type: "sign/MsgSignData", value: { signer: controllerRef.normalizedAddress } }),
          signedBytes: `0x${bytesToHex(signedBytes)}`,
          bech32Prefix,
        },
      };
    },
  };
}

export function createAptosFixture(secretKeyHex: string, chainId = 1) {
  const secretKey = hexToBytes(secretKeyHex);
  const publicKey = ed25519.getPublicKey(secretKey);
  const controllerRef = normalizeControllerRef({
    chainFamily: "aptos",
    networkId: "mainnet",
    chainId,
    address: aptosAddressFromPublicKey(publicKey),
    publicKeyHint: `0x${bytesToHex(publicKey)}`,
  });
  return {
    secretKey,
    publicKey,
    controllerRef,
    signMessage(message: string): ControllerProofEnvelope {
      const nonce = "aptos-nonce";
      const fullMessage = `APTOS\naddress: ${controllerRef.normalizedAddress}\napplication: web3id\nchainId: ${chainId}\nnonce: ${nonce}\nmessage: ${message}`;
      const signature = ed25519.sign(encodeUtf8(fullMessage), secretKey);
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "aptos_sign_message",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(publicKey)}`,
        fullMessage,
        proofPayload: {
          address: controllerRef.normalizedAddress,
          application: "web3id",
          chainId,
          nonce,
          message,
        },
      };
    },
    signSiwa(message: string): ControllerProofEnvelope {
      const nonce = "aptos-siwa-nonce";
      const issuedAt = "2030-03-22T00:00:00.000Z";
      const statement = "Sign in with Aptos to Web3ID.";
      const fullMessage = [
        "APTOS",
        `address: ${controllerRef.normalizedAddress}`,
        "application: web3id",
        `chainId: ${chainId}`,
        `nonce: ${nonce}`,
        `issuedAt: ${issuedAt}`,
        `statement: ${statement}`,
        `message: ${message}`,
      ].join("\n");
      const signature = ed25519.sign(encodeUtf8(fullMessage), secretKey);
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "aptos_siwa",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(publicKey)}`,
        fullMessage,
        proofPayload: {
          address: controllerRef.normalizedAddress,
          application: "web3id",
          chainId,
          nonce,
          message,
          issuedAt,
          statement,
        },
      };
    },
  };
}

export function createSuiFixture(secretKeyHex: string) {
  const secretKey = hexToBytes(secretKeyHex);
  const publicKey = ed25519.getPublicKey(secretKey);
  const controllerRef = normalizeControllerRef({
    chainFamily: "sui",
    networkId: "mainnet",
    address: suiAddressFromPublicKey(publicKey, 0x00),
    signatureScheme: "ed25519",
    publicKeyHint: `0x${bytesToHex(publicKey)}`,
  });
  return {
    secretKey,
    publicKey,
    controllerRef,
    signEd25519(message: string): ControllerProofEnvelope {
      const messageBytes = encodeUtf8(message);
      const signature = ed25519.sign(messageBytes, secretKey);
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "sui_personal_message_ed25519",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(publicKey)}`,
        signatureScheme: "ed25519",
        proofPayload: {
          address: controllerRef.normalizedAddress,
          messageBytes: `0x${bytesToHex(messageBytes)}`,
        },
      };
    },
    signSecp256k1(message: string): ControllerProofEnvelope {
      const secpSecretKey = hexToBytes(secretKeyHex);
      const secpPublicKey = secp256k1.getPublicKey(secpSecretKey, true);
      const messageBytes = encodeUtf8(message);
      const signature = secp256k1.sign(blake2b(messageBytes, { dkLen: 32 }), secpSecretKey, { prehash: false, format: "compact" });
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "sui_personal_message_secp256k1",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(secpPublicKey)}`,
        signatureScheme: "secp256k1",
        proofPayload: {
          address: suiAddressFromPublicKey(secpPublicKey, 0x01),
          messageBytes: `0x${bytesToHex(messageBytes)}`,
        },
      };
    },
    signSecp256r1(message: string): ControllerProofEnvelope {
      const p256SecretKey = hexToBytes(secretKeyHex);
      const p256PublicKey = p256.getPublicKey(p256SecretKey, true);
      const messageBytes = encodeUtf8(message);
      const signature = p256.sign(blake2b(messageBytes, { dkLen: 32 }), p256SecretKey, { prehash: false, format: "compact" });
      return {
        proofEnvelopeVersion: CONTROLLER_PROOF_ENVELOPE_VERSION,
        proofType: "sui_personal_message_secp256r1",
        signature: `0x${bytesToHex(signature)}`,
        publicKey: `0x${bytesToHex(p256PublicKey)}`,
        signatureScheme: "secp256r1",
        proofPayload: {
          address: suiAddressFromPublicKey(p256PublicKey, 0x02),
          messageBytes: `0x${bytesToHex(messageBytes)}`,
        },
      };
    },
  };
}
