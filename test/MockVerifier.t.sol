// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockVerifier} from "../src/mocks/MockVerifier.sol";

contract MockVerifierTest is Test {
    MockVerifier internal verifier;

    function setUp() external {
        verifier = new MockVerifier();
    }

    function testVerifyReturnsTrueWhenPassSignalIsOne() external view {
        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 1;

        bool ok = verifier.verify(hex"1234", publicSignals);
        assertTrue(ok);
    }

    function testVerifyReturnsFalseWhenPassSignalIsZero() external view {
        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 0;

        bool ok = verifier.verify(hex"1234", publicSignals);
        assertFalse(ok);
    }

    function testVerifyReturnsFalseWhenSignalsAreEmpty() external view {
        uint256[] memory publicSignals = new uint256[](0);

        bool ok = verifier.verify(hex"1234", publicSignals);
        assertFalse(ok);
    }
}
