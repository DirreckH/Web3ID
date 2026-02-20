// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IProofVerifier} from "./interfaces/IProofVerifier.sol";

contract RWAGate is Ownable {
    IProofVerifier public verifier;
    mapping(address => uint256) public purchasedAmount;

    event RwaPurchased(address indexed buyer, uint256 amount);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    error InvalidAmount();
    error InvalidVerifier();
    error ProofRejected();

    constructor(address verifier_) Ownable(msg.sender) {
        _setVerifier(verifier_);
    }

    function buyRwa(bytes calldata proof, uint256[] calldata publicSignals, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        if (!verifier.verify(proof, publicSignals)) revert ProofRejected();

        purchasedAmount[msg.sender] += amount;
        emit RwaPurchased(msg.sender, amount);
    }

    function setVerifier(address verifier_) external onlyOwner {
        _setVerifier(verifier_);
    }

    function _setVerifier(address verifier_) internal {
        if (verifier_ == address(0)) revert InvalidVerifier();

        address oldVerifier = address(verifier);
        verifier = IProofVerifier(verifier_);

        emit VerifierUpdated(oldVerifier, verifier_);
    }
}
