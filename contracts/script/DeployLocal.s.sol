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
import {SocialGovernanceGate} from "../src/SocialGovernanceGate.sol";
import {MockRWAAsset} from "../src/MockRWAAsset.sol";
import {Groth16Verifier} from "../src/generated/Groth16Verifier.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";
import {IdentityState} from "../src/interfaces/IComplianceVerifier.sol";

contract DeployLocalScript is Script {
    uint256 internal constant ANVIL_DEFAULT_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    bytes32 internal constant KYC_AML_CREDENTIAL = keccak256("KYC_AML_CREDENTIAL");
    bytes32 internal constant ENTITY_CREDENTIAL = keccak256("ENTITY_CREDENTIAL");
    uint8 internal constant MODE_DEFAULT = 1;
    uint8 internal constant MODE_COMPLIANCE = 2;

    struct Deployment {
        address issuerRegistry;
        address revocationRegistry;
        address stateRegistry;
        address policyRegistry;
        address riskSourceRegistry;
        address complianceVerifier;
        address asset;
        address rwaGate;
        address enterpriseGate;
        address socialGate;
    }

    function run() external {
        uint256 privateKey = vm.envOr("PRIVATE_KEY", ANVIL_DEFAULT_PK);
        address trustedIssuer = vm.envOr("TRUSTED_ISSUER", address(0));
        bool useMockGroth16Verifier = vm.envOr("USE_MOCK_GROTH16_VERIFIER", false);

        vm.startBroadcast(privateKey);
        IssuerRegistry issuerRegistry = new IssuerRegistry();
        RevocationRegistry revocationRegistry = new RevocationRegistry();
        IdentityStateRegistry stateRegistry = new IdentityStateRegistry();
        PolicyRegistry policyRegistry = new PolicyRegistry();
        RiskSourceRegistry riskSourceRegistry = new RiskSourceRegistry();
        IGroth16Verifier groth16Verifier =
            useMockGroth16Verifier ? IGroth16Verifier(address(new MockGroth16Verifier())) : IGroth16Verifier(address(new Groth16Verifier()));
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
        SocialGovernanceGate socialGate = new SocialGovernanceGate(address(complianceVerifier));
        asset.setMinter(address(rwaGate));

        if (trustedIssuer != address(0)) {
            issuerRegistry.setIssuerStatus(trustedIssuer, true, keccak256("trusted-issuer"), keccak256("seed"), 1);
            issuerRegistry.setIssuerCapability(trustedIssuer, KYC_AML_CREDENTIAL, true, keccak256("seed"), 1);
            issuerRegistry.setIssuerCapability(trustedIssuer, ENTITY_CREDENTIAL, true, keccak256("seed"), 1);
        }

        _registerCompliancePolicies(policyRegistry);
        _registerDefaultPolicies(policyRegistry);
        vm.stopBroadcast();

        Deployment memory deployment = Deployment({
            issuerRegistry: address(issuerRegistry),
            revocationRegistry: address(revocationRegistry),
            stateRegistry: address(stateRegistry),
            policyRegistry: address(policyRegistry),
            riskSourceRegistry: address(riskSourceRegistry),
            complianceVerifier: address(complianceVerifier),
            asset: address(asset),
            rwaGate: address(rwaGate),
            enterpriseGate: address(enterpriseGate),
            socialGate: address(socialGate)
        });

        _logDeployment(deployment);
    }

    function _registerCompliancePolicies(PolicyRegistry policyRegistry) internal {
        bytes32[] memory rwaCreds = new bytes32[](1);
        rwaCreds[0] = KYC_AML_CREDENTIAL;
        bytes32[] memory entityCreds = new bytes32[](1);
        entityCreds[0] = ENTITY_CREDENTIAL;
        address[] memory noIssuers = new address[](0);

        _registerPolicy(
            policyRegistry,
            keccak256("RWA_BUY_V2"),
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.NORMAL,
                requiredCredentialTypes: rwaCreds,
                requiredIssuerSet: noIssuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("LOW"),
                enabled: true,
                modeFlags: MODE_COMPLIANCE,
                requiresComplianceMode: true,
                onPassAction: keccak256("ALLOW"),
                onFailAction: keccak256("DENY"),
                onRiskAction: keccak256("RESTRICT"),
                consequenceRule: keccak256("rwa_access_control"),
                explanationTemplate: keccak256("RWA access requires compliance mode")
            })
        );

        _registerPolicy(
            policyRegistry,
            keccak256("ENTITY_PAYMENT_V1"),
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.RESTRICTED,
                requiredCredentialTypes: entityCreds,
                requiredIssuerSet: noIssuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("MEDIUM"),
                enabled: true,
                modeFlags: MODE_COMPLIANCE,
                requiresComplianceMode: true,
                onPassAction: keccak256("ALLOW"),
                onFailAction: keccak256("DENY"),
                onRiskAction: keccak256("REVIEW_REQUIRED"),
                consequenceRule: keccak256("entity_payment_control"),
                explanationTemplate: keccak256("Enterprise payment requires compliance mode")
            })
        );

        _registerPolicy(
            policyRegistry,
            keccak256("ENTITY_AUDIT_V1"),
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.HIGH_RISK,
                requiredCredentialTypes: entityCreds,
                requiredIssuerSet: noIssuers,
                proofTemplate: keccak256("HOLDER_BINDING_GROTH16_V1"),
                expiryRule: keccak256("NOT_EXPIRED"),
                jurisdictionRule: keccak256("GLOBAL"),
                riskTolerance: keccak256("MEDIUM"),
                enabled: true,
                modeFlags: MODE_COMPLIANCE,
                requiresComplianceMode: true,
                onPassAction: keccak256("ALLOW"),
                onFailAction: keccak256("DENY"),
                onRiskAction: keccak256("REVIEW_REQUIRED"),
                consequenceRule: keccak256("entity_audit_control"),
                explanationTemplate: keccak256("Enterprise audit requires compliance mode")
            })
        );
    }

    function _registerDefaultPolicies(PolicyRegistry policyRegistry) internal {
        bytes32[] memory noCreds = new bytes32[](0);
        address[] memory noIssuers = new address[](0);

        _registerPolicy(
            policyRegistry,
            keccak256("GOV_VOTE_V1"),
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.NORMAL,
                requiredCredentialTypes: noCreds,
                requiredIssuerSet: noIssuers,
                proofTemplate: keccak256("HOLDER_BOUND_PROOF"),
                expiryRule: keccak256("NONE"),
                jurisdictionRule: keccak256("COMMUNITY"),
                riskTolerance: keccak256("LOW"),
                enabled: true,
                modeFlags: MODE_DEFAULT,
                requiresComplianceMode: false,
                onPassAction: keccak256("ALLOW"),
                onFailAction: keccak256("DENY"),
                onRiskAction: keccak256("OBSERVE"),
                consequenceRule: keccak256("social_governance_access"),
                explanationTemplate: keccak256("Governance voting uses default mode")
            })
        );

        _registerPolicy(
            policyRegistry,
            keccak256("AIRDROP_ELIGIBILITY_V1"),
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.NORMAL,
                requiredCredentialTypes: noCreds,
                requiredIssuerSet: noIssuers,
                proofTemplate: keccak256("HOLDER_BOUND_PROOF"),
                expiryRule: keccak256("NONE"),
                jurisdictionRule: keccak256("COMMUNITY"),
                riskTolerance: keccak256("LOW"),
                enabled: true,
                modeFlags: MODE_DEFAULT,
                requiresComplianceMode: false,
                onPassAction: keccak256("ACCESS_UNLOCK"),
                onFailAction: keccak256("DENY"),
                onRiskAction: keccak256("OBSERVE"),
                consequenceRule: keccak256("social_airdrop_access"),
                explanationTemplate: keccak256("Airdrop claim uses default mode")
            })
        );

        _registerPolicy(
            policyRegistry,
            keccak256("COMMUNITY_POST_V1"),
            PolicyRegistry.PolicyConfig({
                version: 1,
                minState: IdentityState.NORMAL,
                maxState: IdentityState.NORMAL,
                requiredCredentialTypes: noCreds,
                requiredIssuerSet: noIssuers,
                proofTemplate: keccak256("HOLDER_BOUND_PROOF"),
                expiryRule: keccak256("NONE"),
                jurisdictionRule: keccak256("COMMUNITY"),
                riskTolerance: keccak256("LOW"),
                enabled: true,
                modeFlags: MODE_DEFAULT,
                requiresComplianceMode: false,
                onPassAction: keccak256("ALLOW"),
                onFailAction: keccak256("DENY"),
                onRiskAction: keccak256("OBSERVE"),
                consequenceRule: keccak256("social_post_access"),
                explanationTemplate: keccak256("Community posting uses default mode")
            })
        );
    }

    function _registerPolicy(PolicyRegistry policyRegistry, bytes32 policyId, PolicyRegistry.PolicyConfig memory config)
        internal
    {
        policyRegistry.registerPolicy(policyId, config, keccak256("seed"));
    }

    function _logDeployment(Deployment memory deployment) internal view {
        console2.log("IssuerRegistry:", deployment.issuerRegistry);
        console2.log("RevocationRegistry:", deployment.revocationRegistry);
        console2.log("IdentityStateRegistry:", deployment.stateRegistry);
        console2.log("PolicyRegistry:", deployment.policyRegistry);
        console2.log("RiskSourceRegistry:", deployment.riskSourceRegistry);
        console2.log("ComplianceVerifier:", deployment.complianceVerifier);
        console2.log("MockRWAAsset:", deployment.asset);
        console2.log("RWAGate:", deployment.rwaGate);
        console2.log("EnterpriseGate:", deployment.enterpriseGate);
        console2.log("SocialGate:", deployment.socialGate);
    }
}
