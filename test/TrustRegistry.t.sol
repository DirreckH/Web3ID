// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TrustRegistry} from "../src/TrustRegistry.sol";

contract TrustRegistryTest is Test {
    TrustRegistry internal registry;
    address internal attacker;

    event IssuerTrustUpdated(bytes32 indexed issuerKeyHash, bool trusted);
    event VerifierKeyHashUpdated(bytes32 indexed oldKeyHash, bytes32 indexed newKeyHash);

    function setUp() external {
        registry = new TrustRegistry();
        attacker = makeAddr("attacker");
    }

    function testSetIssuerTrustUpdatesMappingAndEmitsEvent() external {
        bytes32 issuerHash = keccak256("issuer-1");

        vm.expectEmit(true, false, false, true, address(registry));
        emit IssuerTrustUpdated(issuerHash, true);
        registry.setIssuerTrust(issuerHash, true);
        assertTrue(registry.trustedIssuerKeyHashes(issuerHash));

        vm.expectEmit(true, false, false, true, address(registry));
        emit IssuerTrustUpdated(issuerHash, false);
        registry.setIssuerTrust(issuerHash, false);
        assertFalse(registry.trustedIssuerKeyHashes(issuerHash));
    }

    function testSetIssuerTrustRevertsForNonOwner() external {
        bytes32 issuerHash = keccak256("issuer-2");

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        registry.setIssuerTrust(issuerHash, true);
    }

    function testSetVerifierKeyHashUpdatesStateAndEmitsEvent() external {
        bytes32 keyHash = keccak256("vk-1");

        vm.expectEmit(false, false, false, true, address(registry));
        emit VerifierKeyHashUpdated(bytes32(0), keyHash);
        registry.setVerifierKeyHash(keyHash);

        assertEq(registry.verifierKeyHash(), keyHash);
    }

    function testSetVerifierKeyHashRevertsForNonOwner() external {
        bytes32 keyHash = keccak256("vk-2");

        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        registry.setVerifierKeyHash(keyHash);
    }
}
