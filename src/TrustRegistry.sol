// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TrustRegistry is Ownable {
    mapping(bytes32 => bool) public trustedIssuerKeyHashes;
    bytes32 public verifierKeyHash;

    event IssuerTrustUpdated(bytes32 indexed issuerKeyHash, bool trusted);
    event VerifierKeyHashUpdated(bytes32 indexed oldKeyHash, bytes32 indexed newKeyHash);

    constructor() Ownable(msg.sender) {}

    function setIssuerTrust(bytes32 issuerKeyHash, bool trusted) external onlyOwner {
        trustedIssuerKeyHashes[issuerKeyHash] = trusted;
        emit IssuerTrustUpdated(issuerKeyHash, trusted);
    }

    function setVerifierKeyHash(bytes32 keyHash) external onlyOwner {
        bytes32 oldKeyHash = verifierKeyHash;
        verifierKeyHash = keyHash;
        emit VerifierKeyHashUpdated(oldKeyHash, keyHash);
    }
}
