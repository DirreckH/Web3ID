// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract RevocationRegistry is AccessControl {
    bytes32 public constant ISSUER_MANAGER_ROLE = keccak256("ISSUER_MANAGER_ROLE");

    struct RevocationRecord {
        bool revoked;
        bytes32 credentialHash;
        bytes32 replacedByRevocationId;
        uint256 updatedAt;
    }

    mapping(bytes32 => RevocationRecord) internal records;

    event CredentialRevoked(bytes32 indexed revocationId, bytes32 indexed credentialHash, bool revoked);
    event ReplacementLinked(bytes32 indexed revocationId, bytes32 indexed replacedByRevocationId);
    event GovernanceAction(
        address indexed actor, bytes32 indexed action, bytes32 indexed target, bytes32 reason, uint256 version
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ISSUER_MANAGER_ROLE, msg.sender);
    }

    function revoke(bytes32 revocationId, bytes32 credentialHash, bytes32 reason, uint256 version)
        external
        onlyRole(ISSUER_MANAGER_ROLE)
    {
        records[revocationId] = RevocationRecord({
            revoked: true,
            credentialHash: credentialHash,
            replacedByRevocationId: records[revocationId].replacedByRevocationId,
            updatedAt: block.timestamp
        });
        emit CredentialRevoked(revocationId, credentialHash, true);
        emit GovernanceAction(msg.sender, keccak256("REVOKE_CREDENTIAL"), revocationId, reason, version);
    }

    function linkReplacement(bytes32 revocationId, bytes32 replacedByRevocationId, bytes32 reason, uint256 version)
        external
        onlyRole(ISSUER_MANAGER_ROLE)
    {
        records[revocationId].replacedByRevocationId = replacedByRevocationId;
        records[revocationId].updatedAt = block.timestamp;
        emit ReplacementLinked(revocationId, replacedByRevocationId);
        emit GovernanceAction(msg.sender, keccak256("LINK_REPLACEMENT"), revocationId, reason, version);
    }

    function isRevoked(bytes32 revocationId) external view returns (bool) {
        return records[revocationId].revoked;
    }

    function statusOf(bytes32 revocationId)
        external
        view
        returns (bool revoked, bytes32 credentialHash, bytes32 replacedByRevocationId, uint256 updatedAt)
    {
        RevocationRecord memory record = records[revocationId];
        return (record.revoked, record.credentialHash, record.replacedByRevocationId, record.updatedAt);
    }
}
