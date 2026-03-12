// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ComplianceVerifier} from "../../src/ComplianceVerifier.sol";
import {IssuerRegistry} from "../../src/IssuerRegistry.sol";
import {RevocationRegistry} from "../../src/RevocationRegistry.sol";
import {IdentityStateRegistry} from "../../src/IdentityStateRegistry.sol";
import {PolicyRegistry} from "../../src/PolicyRegistry.sol";
import {RiskSourceRegistry} from "../../src/RiskSourceRegistry.sol";
import {RWAGate} from "../../src/RWAGate.sol";
import {EnterpriseTreasuryGate} from "../../src/EnterpriseTreasuryGate.sol";
import {MockRWAAsset} from "../../src/MockRWAAsset.sol";
import {MockGroth16Verifier} from "../../src/mocks/MockGroth16Verifier.sol";
import {
    AccessPayload,
    CredentialAttestationInput,
    HolderAuthorization,
    IdentityState
} from "../../src/interfaces/IComplianceVerifier.sol";

abstract contract Phase2TestBase is Test {
    bytes32 internal constant CREDENTIAL_ATTESTATION_TYPEHASH = keccak256(
        "CredentialAttestation(bytes32 credentialType,bytes32 credentialHash,bytes32 revocationId,bytes32 subjectBinding,address issuer,uint256 expiration,bytes32 claimsHash,bytes32 policyHintsHash)"
    );
    bytes32 internal constant HOLDER_AUTH_TYPEHASH = keccak256(
        "HolderAuthorization(bytes32 identityId,bytes32 subjectBinding,bytes32 policyId,bytes32 requestHash,uint256 chainId,uint256 nonce,uint256 deadline)"
    );
    bytes32 internal constant RWA_POLICY_ID = keccak256("RWA_BUY_V2");
    bytes32 internal constant ENTITY_PAYMENT_POLICY_ID = keccak256("ENTITY_PAYMENT_V1");
    bytes32 internal constant ENTITY_AUDIT_POLICY_ID = keccak256("ENTITY_AUDIT_V1");
    bytes32 internal constant KYC_AML_CREDENTIAL = keccak256("KYC_AML_CREDENTIAL");
    bytes32 internal constant ENTITY_CREDENTIAL = keccak256("ENTITY_CREDENTIAL");

    MockGroth16Verifier internal groth16Verifier;
    IssuerRegistry internal issuerRegistry;
    RevocationRegistry internal revocationRegistry;
    IdentityStateRegistry internal stateRegistry;
    PolicyRegistry internal policyRegistry;
    RiskSourceRegistry internal riskSourceRegistry;
    ComplianceVerifier internal verifier;
    MockRWAAsset internal asset;
    RWAGate internal rwaGate;
    EnterpriseTreasuryGate internal enterpriseGate;

    uint256 internal issuerKey;
    address internal issuer;
    uint256 internal holderKey;
    address internal holder;
    bytes32 internal identityId;
    bytes32 internal subjectBinding;

    function setUpBase() internal {
        (issuer, issuerKey) = makeAddrAndKey("issuer");
        (holder, holderKey) = makeAddrAndKey("holder");
        identityId = keccak256("identity");
        subjectBinding = bytes32(uint256(keccak256(abi.encodePacked(holder))));

        groth16Verifier = new MockGroth16Verifier();
        issuerRegistry = new IssuerRegistry();
        revocationRegistry = new RevocationRegistry();
        stateRegistry = new IdentityStateRegistry();
        policyRegistry = new PolicyRegistry();
        riskSourceRegistry = new RiskSourceRegistry();
        verifier = new ComplianceVerifier(
            address(groth16Verifier),
            address(issuerRegistry),
            address(revocationRegistry),
            address(stateRegistry),
            address(policyRegistry)
        );
        asset = new MockRWAAsset();
        rwaGate = new RWAGate(address(verifier), address(asset));
        enterpriseGate = new EnterpriseTreasuryGate(address(verifier));
        asset.setMinter(address(rwaGate));

        issuerRegistry.setIssuerStatus(issuer, true, keccak256("issuer"), keccak256("seed"), 1);
        issuerRegistry.setIssuerCapability(issuer, KYC_AML_CREDENTIAL, true, keccak256("seed"), 1);
        issuerRegistry.setIssuerCapability(issuer, ENTITY_CREDENTIAL, true, keccak256("seed"), 1);
        stateRegistry.setState(identityId, IdentityState.NORMAL, keccak256("seed"), 1);

        bytes32[] memory rwaCreds = new bytes32[](1);
        rwaCreds[0] = KYC_AML_CREDENTIAL;
        address[] memory rwaIssuers = new address[](1);
        rwaIssuers[0] = issuer;
        policyRegistry.registerPolicy(
            RWA_POLICY_ID,
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.NORMAL,
                requiredCredentialTypes: rwaCreds,
                requiredIssuerSet: rwaIssuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("LOW"),
                enabled: true
            }),
            keccak256("seed")
        );

        bytes32[] memory entityCreds = new bytes32[](1);
        entityCreds[0] = ENTITY_CREDENTIAL;
        address[] memory entityIssuers = new address[](1);
        entityIssuers[0] = issuer;
        policyRegistry.registerPolicy(
            ENTITY_PAYMENT_POLICY_ID,
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.RESTRICTED,
                requiredCredentialTypes: entityCreds,
                requiredIssuerSet: entityIssuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("MEDIUM"),
                enabled: true
            }),
            keccak256("seed")
        );
        policyRegistry.registerPolicy(
            ENTITY_AUDIT_POLICY_ID,
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.HIGH_RISK,
                requiredCredentialTypes: entityCreds,
                requiredIssuerSet: entityIssuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("MEDIUM"),
                enabled: true
            }),
            keccak256("seed")
        );
    }

    function makeAttestation(bytes32 credentialType, bytes32 policyId, uint256 expiration, bytes32 revocationId)
        internal
        returns (CredentialAttestationInput memory attestation)
    {
        bytes32 claimsHash = keccak256("claims");
        bytes32[] memory policyHints = new bytes32[](1);
        policyHints[0] = policyId;
        bytes32 policyHintsHash = keccak256(abi.encode(policyHints));
        bytes32 credentialHash = keccak256(
            abi.encode(credentialType, revocationId, subjectBinding, issuer, expiration, claimsHash, policyHintsHash)
        );

        attestation = CredentialAttestationInput({
            credentialType: credentialType,
            credentialHash: credentialHash,
            revocationId: revocationId,
            subjectBinding: subjectBinding,
            issuer: issuer,
            expiration: expiration,
            claimsHash: claimsHash,
            policyHintsHash: policyHintsHash,
            policyHints: policyHints,
            signature: ""
        });
        attestation.signature = signCredentialAttestation(attestation);
    }

    function signCredentialAttestation(CredentialAttestationInput memory attestation) internal returns (bytes memory) {
        bytes32 structHash = keccak256(
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
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(_credentialDomainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(issuerKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function buildPayload(
        bytes32 policyId,
        bytes32 requestHash,
        string memory domainName,
        address verifyingContract,
        CredentialAttestationInput[] memory attestations
    ) internal returns (AccessPayload memory payload) {
        payload.identityId = identityId;
        payload.credentialAttestations = attestations;
        payload.zkProof.publicSignals[0] = uint256(subjectBinding);
        payload.policyVersion = 1;
        payload.holderAuthorization.identityId = identityId;
        payload.holderAuthorization.subjectBinding = subjectBinding;
        payload.holderAuthorization.policyId = policyId;
        payload.holderAuthorization.requestHash = requestHash;
        payload.holderAuthorization.chainId = block.chainid;
        payload.holderAuthorization.nonce = 1;
        payload.holderAuthorization.deadline = block.timestamp + 1 hours;
        payload.holderAuthorization.signature = signHolderAuthorization(payload.holderAuthorization, domainName, verifyingContract);
    }

    function signHolderAuthorization(HolderAuthorization memory auth, string memory domainName, address verifyingContract)
        internal
        returns (bytes memory)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                HOLDER_AUTH_TYPEHASH,
                auth.identityId,
                auth.subjectBinding,
                auth.policyId,
                auth.requestHash,
                auth.chainId,
                auth.nonce,
                auth.deadline
            )
        );
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparator(domainName, verifyingContract), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(holderKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _credentialDomainSeparator() internal view returns (bytes32) {
        return _domainSeparator("Web3ID Credential", address(verifier));
    }

    function _domainSeparator(string memory name, address verifyingContract) internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes(name)),
                keccak256(bytes("2")),
                block.chainid,
                verifyingContract
            )
        );
    }
}
