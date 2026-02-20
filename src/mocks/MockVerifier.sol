// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProofVerifier} from "../interfaces/IProofVerifier.sol";

contract MockVerifier is IProofVerifier {
    function verify(bytes calldata, uint256[] calldata publicSignals) external pure returns (bool) {
        return publicSignals.length > 0 && publicSignals[0] == 1;
    }
}
