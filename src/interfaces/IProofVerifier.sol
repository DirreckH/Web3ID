// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IProofVerifier {
    function verify(bytes calldata proof, uint256[] calldata publicSignals) external view returns (bool);
}
