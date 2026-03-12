// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TrustRegistry is Ownable {
    mapping(address => bool) public trustedIssuers;
    mapping(bytes32 => bool) public revokedCredentials;

    event TrustedIssuerUpdated(address indexed issuer, bool trusted);
    event CredentialRevoked(bytes32 indexed credentialHash, bool revoked);

    constructor() Ownable(msg.sender) {}

    function addTrustedIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = true;
        emit TrustedIssuerUpdated(issuer, true);
    }

    function removeTrustedIssuer(address issuer) external onlyOwner {
        trustedIssuers[issuer] = false;
        emit TrustedIssuerUpdated(issuer, false);
    }

    function revokeCredential(bytes32 credentialHash) external onlyOwner {
        revokedCredentials[credentialHash] = true;
        emit CredentialRevoked(credentialHash, true);
    }

    function unrevokeCredential(bytes32 credentialHash) external onlyOwner {
        revokedCredentials[credentialHash] = false;
        emit CredentialRevoked(credentialHash, false);
    }

    function isTrustedIssuer(address issuer) external view returns (bool) {
        return trustedIssuers[issuer];
    }

    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return revokedCredentials[credentialHash];
    }
}
