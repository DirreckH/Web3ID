// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {IssuerRegistry} from "../src/IssuerRegistry.sol";
import {RevocationRegistry} from "../src/RevocationRegistry.sol";
import {IdentityStateRegistry} from "../src/IdentityStateRegistry.sol";
import {PolicyRegistry} from "../src/PolicyRegistry.sol";
import {RiskSourceRegistry} from "../src/RiskSourceRegistry.sol";
import {ComplianceVerifier} from "../src/ComplianceVerifier.sol";
import {RWAGate} from "../src/RWAGate.sol";
import {EnterpriseTreasuryGate} from "../src/EnterpriseTreasuryGate.sol";
import {MockRWAAsset} from "../src/MockRWAAsset.sol";
import {Groth16Verifier} from "../src/generated/Groth16Verifier.sol";
import {IdentityState} from "../src/interfaces/IComplianceVerifier.sol";

contract DeployLocalScript is Script {
    uint256 internal constant ANVIL_DEFAULT_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    bytes32 internal constant KYC_AML_CREDENTIAL = keccak256("KYC_AML_CREDENTIAL");
    bytes32 internal constant ENTITY_CREDENTIAL = keccak256("ENTITY_CREDENTIAL");

    function run() external {
        uint256 privateKey = vm.envOr("PRIVATE_KEY", ANVIL_DEFAULT_PK);
        address trustedIssuer = vm.envOr("TRUSTED_ISSUER", address(0));

        vm.startBroadcast(privateKey);
        IssuerRegistry issuerRegistry = new IssuerRegistry();
        RevocationRegistry revocationRegistry = new RevocationRegistry();
        IdentityStateRegistry stateRegistry = new IdentityStateRegistry();
        PolicyRegistry policyRegistry = new PolicyRegistry();
        RiskSourceRegistry riskSourceRegistry = new RiskSourceRegistry();
        Groth16Verifier groth16Verifier = new Groth16Verifier();
        ComplianceVerifier complianceVerifier = new ComplianceVerifier(
            address(groth16Verifier),
            address(issuerRegistry),
            address(revocationRegistry),
            address(stateRegistry),
            address(policyRegistry)
        );
        MockRWAAsset asset = new MockRWAAsset();
        RWAGate rwaGate = new RWAGate(address(complianceVerifier), address(asset));
        EnterpriseTreasuryGate enterpriseGate = new EnterpriseTreasuryGate(address(complianceVerifier));
        asset.setMinter(address(rwaGate));

        if (trustedIssuer != address(0)) {
            issuerRegistry.setIssuerStatus(trustedIssuer, true, keccak256("trusted-issuer"), keccak256("seed"), 1);
            issuerRegistry.setIssuerCapability(trustedIssuer, KYC_AML_CREDENTIAL, true, keccak256("seed"), 1);
            issuerRegistry.setIssuerCapability(trustedIssuer, ENTITY_CREDENTIAL, true, keccak256("seed"), 1);
        }

        bytes32[] memory rwaCreds = new bytes32[](1);
        rwaCreds[0] = KYC_AML_CREDENTIAL;
        address[] memory rwaIssuers = new address[](0);
        policyRegistry.registerPolicy(
            keccak256("RWA_BUY_V2"),
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
        address[] memory entityIssuers = new address[](0);
        policyRegistry.registerPolicy(
            keccak256("ENTITY_PAYMENT_V1"),
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
            keccak256("ENTITY_AUDIT_V1"),
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

        vm.stopBroadcast();

        console2.log("IssuerRegistry:", address(issuerRegistry));
        console2.log("RevocationRegistry:", address(revocationRegistry));
        console2.log("IdentityStateRegistry:", address(stateRegistry));
        console2.log("PolicyRegistry:", address(policyRegistry));
        console2.log("RiskSourceRegistry:", address(riskSourceRegistry));
        console2.log("ComplianceVerifier:", address(complianceVerifier));
        console2.log("MockRWAAsset:", address(asset));
        console2.log("RWAGate:", address(rwaGate));
        console2.log("EnterpriseGate:", address(enterpriseGate));
    }
}
