// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ComplianceVerifier} from "../src/ComplianceVerifier.sol";
import {AccessPayload, CredentialAttestationInput, IdentityState} from "../src/interfaces/IComplianceVerifier.sol";
import {Phase2TestBase} from "./helpers/Phase2TestBase.sol";

contract ComplianceVerifierTest is Phase2TestBase {
    function setUp() external {
        setUpBase();
    }

    function testVerifyAccessPassesForValidPayload() external {
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, keccak256("rev"));
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(1))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        assertTrue(verifier.verifyAccess(RWA_POLICY_ID, payload));
    }

    function testVerifyAccessRejectsWrongState() external {
        stateRegistry.setState(identityId, IdentityState.RESTRICTED, keccak256("risk"), 2);
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, keccak256("rev"));
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(1))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        vm.expectRevert(ComplianceVerifier.InvalidState.selector);
        verifier.verifyAccess(RWA_POLICY_ID, payload);
    }

    function testVerifyAccessRejectsRevokedCredential() external {
        bytes32 revocationId = keccak256("revoked");
        revocationRegistry.revoke(revocationId, keccak256("credHash"), keccak256("reason"), 2);
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, revocationId);
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(1))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        vm.expectRevert(ComplianceVerifier.RevokedCredential.selector);
        verifier.verifyAccess(RWA_POLICY_ID, payload);
    }

    function testVerifyAccessRejectsBadSignature() external {
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, keccak256("rev"));
        attestations[0].signature = hex"1234";
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(1))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        vm.expectRevert();
        verifier.verifyAccess(RWA_POLICY_ID, payload);
    }

    function testVerifyAccessRejectsGroth16Failure() external {
        groth16Verifier.setShouldPass(false);
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, keccak256("rev"));
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(1))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        vm.expectRevert(ComplianceVerifier.InvalidProof.selector);
        verifier.verifyAccess(RWA_POLICY_ID, payload);
    }

    function testVerifyAccessRejectsCompliancePolicyWithoutCredentialPayload() external {
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](0);
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(1))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        vm.expectRevert(ComplianceVerifier.InvalidMode.selector);
        verifier.verifyAccess(RWA_POLICY_ID, payload);
    }

    function testVerifyAccessPassesForDefaultModePolicyWithoutCredentials() external {
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](0);
        AccessPayload memory payload = buildPayload(
            GOV_VOTE_POLICY_ID,
            keccak256(abi.encodePacked("VOTE", address(socialGate), keccak256("proposal-1"))),
            "Web3ID Social Governance",
            address(socialGate),
            attestations
        );

        assertTrue(verifier.verifyAccess(GOV_VOTE_POLICY_ID, payload));
    }
}
