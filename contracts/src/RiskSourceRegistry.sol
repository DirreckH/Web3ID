// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract RiskSourceRegistry is AccessControl {
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");

    enum RiskSourceType {
        TRUSTED_ANALYZER,
        MANUAL_REVIEWER,
        COMPLIANCE_ORACLE,
        EXTERNAL_SIGNAL_ADAPTER
    }

    struct RiskSourceRecord {
        RiskSourceType sourceType;
        bool enabled;
        bytes32 metadataHash;
    }

    mapping(address => RiskSourceRecord) internal sources;

    event RiskSourceUpdated(address indexed source, RiskSourceType sourceType, bool enabled, bytes32 metadataHash);
    event GovernanceAction(address indexed actor, bytes32 indexed action, bytes32 indexed target, bytes32 reason, uint256 version);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
    }

    function setSourceStatus(
        address source,
        RiskSourceType sourceType,
        bool enabled,
        bytes32 metadataHash,
        bytes32 reason,
        uint256 version
    ) external onlyRole(RISK_MANAGER_ROLE) {
        sources[source] = RiskSourceRecord({sourceType: sourceType, enabled: enabled, metadataHash: metadataHash});
        emit RiskSourceUpdated(source, sourceType, enabled, metadataHash);
        emit GovernanceAction(msg.sender, keccak256("SET_RISK_SOURCE"), bytes32(uint256(uint160(source))), reason, version);
    }

    function getSource(address source) external view returns (RiskSourceType sourceType, bool enabled, bytes32 metadataHash) {
        RiskSourceRecord memory record = sources[source];
        return (record.sourceType, record.enabled, record.metadataHash);
    }
}
