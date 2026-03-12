// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract IssuerRegistry is AccessControl {
    bytes32 public constant ISSUER_MANAGER_ROLE = keccak256("ISSUER_MANAGER_ROLE");

    struct IssuerRecord {
        bool enabled;
        bytes32 metadataHash;
    }

    mapping(address => IssuerRecord) internal issuerRecords;
    mapping(address => mapping(bytes32 => bool)) internal issuerCapabilities;

    event IssuerStatusUpdated(address indexed issuer, bool enabled, bytes32 metadataHash);
    event IssuerCapabilityUpdated(address indexed issuer, bytes32 indexed credentialType, bool enabled);
    event GovernanceAction(
        address indexed actor, bytes32 indexed action, bytes32 indexed target, bytes32 reason, uint256 version
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_MANAGER_ROLE, msg.sender);
    }

    function setIssuerStatus(address issuer, bool enabled, bytes32 metadataHash, bytes32 reason, uint256 version)
        external
        onlyRole(ISSUER_MANAGER_ROLE)
    {
        issuerRecords[issuer] = IssuerRecord({enabled: enabled, metadataHash: metadataHash});
        emit IssuerStatusUpdated(issuer, enabled, metadataHash);
        emit GovernanceAction(
            msg.sender, keccak256("SET_ISSUER_STATUS"), bytes32(uint256(uint160(issuer))), reason, version
        );
    }

    function setIssuerCapability(address issuer, bytes32 credentialType, bool enabled, bytes32 reason, uint256 version)
        external
        onlyRole(ISSUER_MANAGER_ROLE)
    {
        issuerCapabilities[issuer][credentialType] = enabled;
        emit IssuerCapabilityUpdated(issuer, credentialType, enabled);
        emit GovernanceAction(
            msg.sender, keccak256("SET_ISSUER_CAPABILITY"), bytes32(uint256(uint160(issuer))), reason, version
        );
    }

    function getIssuer(address issuer) external view returns (bool enabled, bytes32 metadataHash) {
        IssuerRecord memory record = issuerRecords[issuer];
        return (record.enabled, record.metadataHash);
    }

    function isIssuerEnabled(address issuer) external view returns (bool) {
        return issuerRecords[issuer].enabled;
    }

    function hasCapability(address issuer, bytes32 credentialType) external view returns (bool) {
        return issuerCapabilities[issuer][credentialType];
    }
}
