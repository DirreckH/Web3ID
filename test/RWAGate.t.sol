// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {RWAGate} from "../src/RWAGate.sol";
import {MockVerifier} from "../src/mocks/MockVerifier.sol";
import {IProofVerifier} from "../src/interfaces/IProofVerifier.sol";

contract AlwaysPassVerifier is IProofVerifier {
    function verify(bytes calldata, uint256[] calldata) external pure returns (bool) {
        return true;
    }
}

contract RWAGateTest is Test {
    RWAGate internal gate;
    MockVerifier internal mockVerifier;
    AlwaysPassVerifier internal alwaysPassVerifier;

    address internal alice;
    address internal attacker;

    event RwaPurchased(address indexed buyer, uint256 amount);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    function setUp() external {
        alice = makeAddr("alice");
        attacker = makeAddr("attacker");

        mockVerifier = new MockVerifier();
        alwaysPassVerifier = new AlwaysPassVerifier();
        gate = new RWAGate(address(mockVerifier));
    }

    function testBuyRwaRevertsWhenAmountIsZero() external {
        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 1;

        vm.prank(alice);
        vm.expectRevert(RWAGate.InvalidAmount.selector);
        gate.buyRwa(hex"1234", publicSignals, 0);
    }

    function testBuyRwaRevertsWhenProofRejected() external {
        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 0;

        vm.prank(alice);
        vm.expectRevert(RWAGate.ProofRejected.selector);
        gate.buyRwa(hex"1234", publicSignals, 10);
    }

    function testBuyRwaSucceedsAndAccumulatesAmount() external {
        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = 1;

        vm.prank(alice);
        vm.expectEmit(true, false, false, true, address(gate));
        emit RwaPurchased(alice, 10);
        gate.buyRwa(hex"1234", publicSignals, 10);

        assertEq(gate.purchasedAmount(alice), 10);

        vm.prank(alice);
        gate.buyRwa(hex"1234", publicSignals, 5);
        assertEq(gate.purchasedAmount(alice), 15);
    }

    function testSetVerifierUpdatesVerifierWhenCalledByOwner() external {
        address oldVerifier = address(gate.verifier());

        vm.expectEmit(true, true, false, false, address(gate));
        emit VerifierUpdated(oldVerifier, address(alwaysPassVerifier));
        gate.setVerifier(address(alwaysPassVerifier));

        assertEq(address(gate.verifier()), address(alwaysPassVerifier));
    }

    function testSetVerifierRevertsWhenCallerIsNotOwner() external {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        gate.setVerifier(address(alwaysPassVerifier));
    }

    function testSetVerifierRevertsOnZeroAddress() external {
        vm.expectRevert(RWAGate.InvalidVerifier.selector);
        gate.setVerifier(address(0));
    }
}
