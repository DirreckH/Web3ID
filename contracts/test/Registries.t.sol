// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IdentityState} from "../src/interfaces/IComplianceVerifier.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {IdentityStateRegistry} from "../src/IdentityStateRegistry.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {RiskSourceRegistry} from "../src/RiskSourceRegistry.sol";

contract RegistriesTest is Test {
    function testIssuerAndRevocationRegistries() external {
        IssuerRegistry issuerRegistry = new IssuerRegistry();
        RevocationRegistry revocationRegistry = new RevocationRegistry();
        address issuer = makeAddr("issuer");
        bytes32 credentialType = keccak256("KYC_AML_CREDENTIAL");
        bytes32 revocationId = keccak256("revocation");
        bytes32 credentialHash = keccak256("credentialHash");

        issuerRegistry.setIssuerStatus(issuer, true, keccak256("metadata"), keccak256("reason"), 1);
        issuerRegistry.setIssuerCapability(issuer, credentialType, true, keccak256("reason"), 1);
        assertTrue(issuerRegistry.isIssuerEnabled(issuer));
        assertTrue(issuerRegistry.hasCapability(issuer, credentialType));

        revocationRegistry.revoke(revocationId, credentialHash, keccak256("reason"), 1);
        assertTrue(revocationRegistry.isRevoked(revocationId));
    }

    function testIdentityStateRegistryTransitions() external {
        IdentityStateRegistry stateRegistry = new IdentityStateRegistry();
        bytes32 identityId = keccak256("identity");
        stateRegistry.setState(identityId, IdentityState.NORMAL, keccak256("reason"), 1);
        assertEq(uint8(stateRegistry.getState(identityId)), uint8(IdentityState.NORMAL));

        stateRegistry.setState(identityId, IdentityState.OBSERVED, keccak256("reason"), 2);
        assertEq(uint8(stateRegistry.getState(identityId)), uint8(IdentityState.OBSERVED));

        vm.expectRevert();
        stateRegistry.setState(identityId, IdentityState.INIT, keccak256("rollback"), 3);
    }

    function testPolicyAndRiskSourceRegistries() external {
        PolicyRegistry policyRegistry = new PolicyRegistry();
        RiskSourceRegistry riskSourceRegistry = new RiskSourceRegistry();
        bytes32 policyId = keccak256("ENTITY_PAYMENT_V1");
        bytes32[] memory credentialTypes = new bytes32[](1);
        credentialTypes[0] = keccak256("ENTITY_CREDENTIAL");
        address[] memory issuers = new address[](0);

        policyRegistry.registerPolicy(
            policyId,
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.RESTRICTED,
                requiredCredentialTypes: credentialTypes,
                requiredIssuerSet: issuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("MEDIUM"),
                enabled: true
            }),
            keccak256("reason")
        );
        (,,, bytes32[] memory requiredCredentialTypes,,,,,, bool enabled) = policyRegistry.getPolicy(policyId);
        assertEq(requiredCredentialTypes[0], credentialTypes[0]);
        assertTrue(enabled);

        address source = makeAddr("source");
        riskSourceRegistry.setSourceStatus(
            source, RiskSourceRegistry.RiskSourceType.TRUSTED_ANALYZER, true, keccak256("meta"), keccak256("reason"), 1
        );
        (, bool sourceEnabled,) = riskSourceRegistry.getSource(source);
        assertTrue(sourceEnabled);
    }
}
