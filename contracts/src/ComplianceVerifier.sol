// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IGroth16Verifier} from "./interfaces/IGroth16Verifier.sol";
import {
    AccessPayload,
    CredentialAttestationInput,
    IComplianceVerifier,
    IdentityState
} from "./interfaces/IComplianceVerifier.sol";
import {IssuerRegistry} from "./IssuerRegistry.sol";
import {RevocationRegistry} from "./RevocationRegistry.sol";
import {IdentityStateRegistry} from "./IdentityStateRegistry.sol";
import {PolicyRegistry} from "./PolicyRegistry.sol";

contract ComplianceVerifier is IComplianceVerifier, EIP712 {
    bytes32 internal constant CREDENTIAL_ATTESTATION_TYPEHASH = keccak256(
        "CredentialAttestation(bytes32 credentialType,bytes32 credentialHash,bytes32 revocationId,bytes32 subjectBinding,address issuer,uint256 expiration,bytes32 claimsHash,bytes32 policyHintsHash)"
    );

    IGroth16Verifier public immutable groth16Verifier;
    IssuerRegistry public immutable issuerRegistry;
    RevocationRegistry public immutable revocationRegistry;
    IdentityStateRegistry public immutable identityStateRegistry;
    PolicyRegistry public immutable policyRegistry;

    error DisabledPolicy();
    error WrongPolicyVersion();
    error InvalidState();
    error InvalidCredentialSet();
    error InvalidIssuer();
    error RevokedCredential();
    error ExpiredCredential();
    error InvalidPolicyHints();
    error InvalidCredentialSignature();
    error InvalidHolderBinding();
    error InvalidProof();
    error InvalidHolderAuthorization();

    constructor(
        address groth16Verifier_,
        address issuerRegistry_,
        address revocationRegistry_,
        address identityStateRegistry_,
        address policyRegistry_
    ) EIP712("Web3ID Credential", "2") {
        groth16Verifier = IGroth16Verifier(groth16Verifier_);
        issuerRegistry = IssuerRegistry(issuerRegistry_);
        revocationRegistry = RevocationRegistry(revocationRegistry_);
        identityStateRegistry = IdentityStateRegistry(identityStateRegistry_);
        policyRegistry = PolicyRegistry(policyRegistry_);
    }

    function verifyAccess(bytes32 policyId, AccessPayload calldata payload) external view returns (bool) {
        if (payload.identityId != payload.holderAuthorization.identityId) revert InvalidHolderAuthorization();
        if (payload.holderAuthorization.policyId != policyId) revert InvalidHolderAuthorization();
        if (bytes32(payload.zkProof.publicSignals[0]) != payload.holderAuthorization.subjectBinding) {
            revert InvalidHolderAuthorization();
        }

        (
            uint256 version,
            IdentityState minState,
            IdentityState maxState,
            bytes32[] memory requiredCredentialTypes,
            address[] memory requiredIssuerSet,,,,,
            bool enabled
        ) = policyRegistry.getPolicy(policyId);

        if (!enabled) revert DisabledPolicy();
        if (version != payload.policyVersion) revert WrongPolicyVersion();

        IdentityState currentState = identityStateRegistry.getState(payload.identityId);
        if (uint8(currentState) < uint8(minState) || uint8(currentState) > uint8(maxState)) revert InvalidState();

        if (!_verifyProof(payload)) revert InvalidProof();

        bool[] memory satisfiedTypes = new bool[](requiredCredentialTypes.length);
        for (uint256 index = 0; index < payload.credentialAttestations.length; index++) {
            CredentialAttestationInput calldata attestation = payload.credentialAttestations[index];
            if (attestation.subjectBinding != payload.holderAuthorization.subjectBinding) {
                revert InvalidHolderBinding();
            }
            if (attestation.expiration <= block.timestamp) revert ExpiredCredential();
            if (revocationRegistry.isRevoked(attestation.revocationId)) revert RevokedCredential();
            if (!issuerRegistry.isIssuerEnabled(attestation.issuer)) revert InvalidIssuer();
            if (!issuerRegistry.hasCapability(attestation.issuer, attestation.credentialType)) revert InvalidIssuer();
            if (!_policyHintMatches(policyId, attestation.policyHints, attestation.policyHintsHash)) {
                revert InvalidPolicyHints();
            }
            if (!_issuerAllowed(requiredIssuerSet, attestation.issuer)) revert InvalidIssuer();
            if (!_verifyCredentialAttestation(attestation)) revert InvalidCredentialSignature();

            for (uint256 typeIndex = 0; typeIndex < requiredCredentialTypes.length; typeIndex++) {
                if (attestation.credentialType == requiredCredentialTypes[typeIndex]) {
                    satisfiedTypes[typeIndex] = true;
                }
            }
        }

        for (uint256 index = 0; index < satisfiedTypes.length; index++) {
            if (!satisfiedTypes[index]) revert InvalidCredentialSet();
        }

        return true;
    }

    function _verifyCredentialAttestation(CredentialAttestationInput calldata attestation)
        internal
        view
        returns (bool)
    {
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CREDENTIAL_ATTESTATION_TYPEHASH,
                    attestation.credentialType,
                    attestation.credentialHash,
                    attestation.revocationId,
                    attestation.subjectBinding,
                    attestation.issuer,
                    attestation.expiration,
                    attestation.claimsHash,
                    attestation.policyHintsHash
                )
            )
        );

        return ECDSA.recover(digest, attestation.signature) == attestation.issuer;
    }

    function _verifyProof(AccessPayload calldata payload) internal view returns (bool) {
        uint256[2] memory a = [payload.zkProof.proofPoints[0], payload.zkProof.proofPoints[1]];
        uint256[2][2] memory b = [
            [payload.zkProof.proofPoints[2], payload.zkProof.proofPoints[3]],
            [payload.zkProof.proofPoints[4], payload.zkProof.proofPoints[5]]
        ];
        uint256[2] memory c = [payload.zkProof.proofPoints[6], payload.zkProof.proofPoints[7]];
        uint256[1] memory statement = [payload.zkProof.publicSignals[0]];

        return groth16Verifier.verifyProof(a, b, c, statement);
    }

    function _policyHintMatches(bytes32 policyId, bytes32[] calldata policyHints, bytes32 policyHintsHash)
        internal
        pure
        returns (bool)
    {
        if (keccak256(abi.encode(policyHints)) != policyHintsHash) {
            return false;
        }
        for (uint256 index = 0; index < policyHints.length; index++) {
            if (policyHints[index] == policyId) {
                return true;
            }
        }
        return false;
    }

    function _issuerAllowed(address[] memory allowedIssuers, address issuer) internal pure returns (bool) {
        if (allowedIssuers.length == 0) {
            return true;
        }
        for (uint256 index = 0; index < allowedIssuers.length; index++) {
            if (allowedIssuers[index] == issuer) {
                return true;
            }
        }
        return false;
    }
}
