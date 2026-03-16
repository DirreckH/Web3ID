// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IdentityState} from "./interfaces/IComplianceVerifier.sol";

contract PolicyRegistry is AccessControl {
    bytes32 public constant POLICY_MANAGER_ROLE = keccak256("POLICY_MANAGER_ROLE");
    uint8 public constant MODE_DEFAULT = 1;
    uint8 public constant MODE_COMPLIANCE = 2;

    struct PolicyConfig {
        uint256 version;
        IdentityState minState;
        IdentityState maxState;
        bytes32[] requiredCredentialTypes;
        address[] requiredIssuerSet;
        bytes32 proofTemplate;
        bytes32 expiryRule;
        bytes32 jurisdictionRule;
        bytes32 riskTolerance;
        bool enabled;
        uint8 modeFlags;
        bool requiresComplianceMode;
        bytes32 onPassAction;
        bytes32 onFailAction;
        bytes32 onRiskAction;
        bytes32 consequenceRule;
        bytes32 explanationTemplate;
    }

    struct PolicyRecord {
        uint256 version;
        IdentityState minState;
        IdentityState maxState;
        bytes32[] requiredCredentialTypes;
        address[] requiredIssuerSet;
        bytes32 proofTemplate;
        bytes32 expiryRule;
        bytes32 jurisdictionRule;
        bytes32 riskTolerance;
        bool enabled;
        uint8 modeFlags;
        bool requiresComplianceMode;
        bytes32 onPassAction;
        bytes32 onFailAction;
        bytes32 onRiskAction;
        bytes32 consequenceRule;
        bytes32 explanationTemplate;
    }

    mapping(bytes32 => PolicyRecord) internal policies;

    event PolicyRegistered(bytes32 indexed policyId, uint256 version, bool enabled);
    event PolicyEnabled(bytes32 indexed policyId, bool enabled);
    event GovernanceAction(
        address indexed actor, bytes32 indexed action, bytes32 indexed target, bytes32 reason, uint256 version
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(POLICY_MANAGER_ROLE, msg.sender);
    }

    function registerPolicy(bytes32 policyId, PolicyConfig calldata config, bytes32 reason)
        external
        onlyRole(POLICY_MANAGER_ROLE)
    {
        PolicyRecord storage record = policies[policyId];
        record.version = config.version;
        record.minState = config.minState;
        record.maxState = config.maxState;
        record.proofTemplate = config.proofTemplate;
        record.expiryRule = config.expiryRule;
        record.jurisdictionRule = config.jurisdictionRule;
        record.riskTolerance = config.riskTolerance;
        record.enabled = config.enabled;
        record.modeFlags = config.modeFlags;
        record.requiresComplianceMode = config.requiresComplianceMode;
        record.onPassAction = config.onPassAction;
        record.onFailAction = config.onFailAction;
        record.onRiskAction = config.onRiskAction;
        record.consequenceRule = config.consequenceRule;
        record.explanationTemplate = config.explanationTemplate;
        _replaceBytes32Array(record.requiredCredentialTypes, config.requiredCredentialTypes);
        _replaceAddressArray(record.requiredIssuerSet, config.requiredIssuerSet);

        emit PolicyRegistered(policyId, config.version, config.enabled);
        emit GovernanceAction(msg.sender, keccak256("REGISTER_POLICY"), policyId, reason, config.version);
    }

    function setPolicyEnabled(bytes32 policyId, bool enabled, bytes32 reason, uint256 version)
        external
        onlyRole(POLICY_MANAGER_ROLE)
    {
        policies[policyId].enabled = enabled;
        emit PolicyEnabled(policyId, enabled);
        emit GovernanceAction(msg.sender, keccak256("SET_POLICY_ENABLED"), policyId, reason, version);
    }

    function getPolicy(bytes32 policyId)
        external
        view
        returns (
            uint256 version,
            IdentityState minState,
            IdentityState maxState,
            bytes32[] memory requiredCredentialTypes,
            address[] memory requiredIssuerSet,
            bytes32 proofTemplate,
            bytes32 expiryRule,
            bytes32 jurisdictionRule,
            bytes32 riskTolerance,
            bool enabled
        )
    {
        PolicyRecord storage record = policies[policyId];
        return (
            record.version,
            record.minState,
            record.maxState,
            record.requiredCredentialTypes,
            record.requiredIssuerSet,
            record.proofTemplate,
            record.expiryRule,
            record.jurisdictionRule,
            record.riskTolerance,
            record.enabled
        );
    }

    function getPolicyModeConfig(bytes32 policyId)
        external
        view
        returns (
            uint8 modeFlags,
            bool requiresComplianceMode,
            bytes32 onPassAction,
            bytes32 onFailAction,
            bytes32 onRiskAction,
            bytes32 consequenceRule,
            bytes32 explanationTemplate
        )
    {
        PolicyRecord storage record = policies[policyId];
        return (
            record.modeFlags,
            record.requiresComplianceMode,
            record.onPassAction,
            record.onFailAction,
            record.onRiskAction,
            record.consequenceRule,
            record.explanationTemplate
        );
    }

    function _replaceBytes32Array(bytes32[] storage target, bytes32[] calldata source) internal {
        while (target.length > 0) {
            target.pop();
        }
        for (uint256 index = 0; index < source.length; index++) {
            target.push(source[index]);
        }
    }

    function _replaceAddressArray(address[] storage target, address[] calldata source) internal {
        while (target.length > 0) {
            target.pop();
        }
        for (uint256 index = 0; index < source.length; index++) {
            target.push(source[index]);
        }
    }
}
