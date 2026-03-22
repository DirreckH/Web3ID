# Chain Family Matrix

## Family Overview

| Family | Network baseline | Proof types | Address normalization | `didLikeId` pattern | Verifier kind | Offline-first |
| --- | --- | --- | --- | --- | --- | --- |
| `evm` | `1`, `42161`, `8453`, `10` | `eip191` | checksum hex address | `did:pkh:eip155:<chainId>:<checksumAddress>` | recovered ECDSA signer | yes |
| `solana` | `mainnet-beta` | `solana_ed25519` | base58 pubkey address | existing Solana rule | Ed25519 detached message | yes |
| `bitcoin` | `mainnet` | `bitcoin_bip322`, `bitcoin_legacy` | base58 or bech32 to canonical string | existing Bitcoin rule | BIP-322 or legacy message verify | yes |
| `tron` | `mainnet` | `tron_signed_message_v2` | hex or base58 to canonical base58 | `did:pkh:tron:<networkId>:<normalizedAddress>` | recovered TIP-191 style signer | yes |
| `ton` | `mainnet` | `ton_proof_v2` | canonical user-friendly address | `did:pkh:ton:<networkId>:<normalizedAddress>` | `ton_proof` payload + Ed25519 verify | yes |
| `cosmos` | `kava_2222-10`, `cosmoshub-4` | `cosmos_adr036_direct`, `cosmos_adr036_legacy_amino` | bech32 canonical address | `did:pkh:cosmos:<chainNamespace>:<networkId>:<normalizedAddress>` | ADR-036 signature verify | yes |
| `aptos` | `mainnet` | `aptos_sign_message`, `aptos_siwa` | canonical 32-byte hex account address | `did:pkh:aptos:<networkId>:<normalizedAddress>` | Ed25519 full-message verify | yes |
| `sui` | `mainnet` | `sui_personal_message_ed25519`, `sui_personal_message_secp256k1`, `sui_personal_message_secp256r1` | canonical 32-byte hex account address | `did:pkh:sui:<networkId>:<normalizedAddress>` | scheme-dispatched personal message verify | yes |

## Cryptographic Families

| Cryptographic family | Web3ID families |
| --- | --- |
| secp256k1 recovered message | `evm`, `tron` |
| Ed25519 detached message | `solana`, `ton`, `aptos`, `sui(ed25519)` |
| secp256k1 explicit pubkey verify | `bitcoin`, `cosmos`, `sui(secp256k1)` |
| secp256r1 explicit pubkey verify | `sui(secp256r1)` |

## Network Presets

### EVM registry presets

| Network ref | Chain id | Label |
| --- | --- | --- |
| `eip155:1` | `1` | Ethereum Mainnet |
| `eip155:42161` | `42161` | Arbitrum One |
| `eip155:8453` | `8453` | Base |
| `eip155:10` | `10` | OP Mainnet |

### Other preset baselines

| Family | Supported presets | Acceptance baseline |
| --- | --- | --- |
| `tron` | `mainnet` | `mainnet` |
| `ton` | `mainnet` | `mainnet` |
| `cosmos` | `kava_2222-10`, `cosmoshub-4` | `kava_2222-10` |
| `aptos` | `mainnet` | `mainnet` |
| `sui` | `mainnet` | `mainnet` |

## Challenge Mapping Notes

- every family signs or packages the same canonical challenge envelope
- no family redefines the envelope itself
- replay scope always comes from the canonical challenge fields
- structured proof payloads are validated before verifier dispatch

## Fallback Policy

| Family | Runtime fallback | Merge gate dependency |
| --- | --- | --- |
| `evm` | none required | no |
| `solana` | none required | no |
| `bitcoin` | none required | no |
| `tron` | none required | no |
| `ton` | optional public-key resolver | no |
| `cosmos` | none required | no |
| `aptos` | none required | no |
| `sui` | none required | no |
