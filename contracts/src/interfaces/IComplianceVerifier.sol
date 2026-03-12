// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

enum IdentityState {
    INIT,
    NORMAL,
    OBSERVED,
    RESTRICTED,
    HIGH_RISK,
    FROZEN
}

struct CredentialAttestationInput {
    bytes32 credentialType;
    bytes32 credentialHash;
    bytes32 revocationId;
    bytes32 subjectBinding;
    address issuer;
    uint256 expiration;
    bytes32 claimsHash;
    bytes32 policyHintsHash;
    bytes32[] policyHints;
    bytes signature;
}

struct ZkProofInput {
    uint256[8] proofPoints;
    uint256[1] publicSignals;
}

struct HolderAuthorization {
    bytes32 identityId;
    bytes32 subjectBinding;
    bytes32 policyId;
    bytes32 requestHash;
    uint256 chainId;
    uint256 nonce;
    uint256 deadline;
    bytes signature;
}

struct AccessPayload {
    bytes32 identityId;
    CredentialAttestationInput[] credentialAttestations;
    ZkProofInput zkProof;
    uint256 policyVersion;
    HolderAuthorization holderAuthorization;
}

interface IComplianceVerifier {
    function verifyAccess(bytes32 policyId, AccessPayload calldata payload) external view returns (bool);
}
