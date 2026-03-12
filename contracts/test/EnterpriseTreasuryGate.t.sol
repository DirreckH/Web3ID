// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EnterpriseTreasuryGate} from "../src/EnterpriseTreasuryGate.sol";
import {AccessPayload, CredentialAttestationInput, IdentityState} from "../src/interfaces/IComplianceVerifier.sol";
import {Phase2TestBase} from "./helpers/Phase2TestBase.sol";

contract EnterpriseTreasuryGateTest is Phase2TestBase {
    function setUp() external {
        setUpBase();
    }

    function testSubmitPaymentPassesForEntityCredential() external {
        bytes32 paymentRef = keccak256("payment-1");
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(
            ENTITY_CREDENTIAL, ENTITY_PAYMENT_POLICY_ID, block.timestamp + 1 days, keccak256("entity-payment")
        );
        AccessPayload memory payload = buildPayload(
            ENTITY_PAYMENT_POLICY_ID,
            keccak256(
                abi.encodePacked("PAYMENT", address(enterpriseGate), makeAddr("beneficiary"), uint256(50), paymentRef)
            ),
            "Web3ID Enterprise Treasury",
            address(enterpriseGate),
            attestations
        );

        vm.prank(holder);
        enterpriseGate.submitPayment(payload, makeAddr("beneficiary"), 50, paymentRef);

        assertEq(enterpriseGate.paymentCount(), 1);
    }

    function testSubmitPaymentRejectsRestrictedState() external {
        bytes32 paymentRef = keccak256("payment-1");
        stateRegistry.setState(identityId, IdentityState.HIGH_RISK, keccak256("risk"), 2);
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(
            ENTITY_CREDENTIAL, ENTITY_PAYMENT_POLICY_ID, block.timestamp + 1 days, keccak256("entity-payment")
        );
        AccessPayload memory payload = buildPayload(
            ENTITY_PAYMENT_POLICY_ID,
            keccak256(
                abi.encodePacked("PAYMENT", address(enterpriseGate), makeAddr("beneficiary"), uint256(50), paymentRef)
            ),
            "Web3ID Enterprise Treasury",
            address(enterpriseGate),
            attestations
        );

        vm.prank(holder);
        vm.expectRevert();
        enterpriseGate.submitPayment(payload, makeAddr("beneficiary"), 50, paymentRef);
    }

    function testAuditExportPasses() external {
        bytes32 auditRef = keccak256("audit-1");
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(
            ENTITY_CREDENTIAL, ENTITY_AUDIT_POLICY_ID, block.timestamp + 1 days, keccak256("entity-audit")
        );
        AccessPayload memory payload = buildPayload(
            ENTITY_AUDIT_POLICY_ID,
            keccak256(abi.encodePacked("AUDIT", address(enterpriseGate), auditRef)),
            "Web3ID Enterprise Treasury",
            address(enterpriseGate),
            attestations
        );

        vm.prank(holder);
        enterpriseGate.exportAuditRecord(payload, auditRef);
    }
}
