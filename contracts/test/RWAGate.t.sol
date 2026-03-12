// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RWAGate} from "../src/RWAGate.sol";
import {AccessPayload, CredentialAttestationInput} from "../src/interfaces/IComplianceVerifier.sol";
import {Phase2TestBase} from "./helpers/Phase2TestBase.sol";

contract RWAGateTest is Phase2TestBase {
    function setUp() external {
        setUpBase();
    }

    function testBuyRwaMintsAssetForValidPayload() external {
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, keccak256("rev"));
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(10))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );

        vm.prank(holder);
        rwaGate.buyRwa(payload, 10);

        assertEq(rwaGate.purchasedAmount(holder), 10);
        assertEq(asset.balanceOf(holder), 10);
    }

    function testBuyRwaRejectsInvalidHolderAuthorization() external {
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](1);
        attestations[0] = makeAttestation(KYC_AML_CREDENTIAL, RWA_POLICY_ID, block.timestamp + 1 days, keccak256("rev"));
        AccessPayload memory payload = buildPayload(
            RWA_POLICY_ID,
            keccak256(abi.encodePacked("BUY_RWA", address(rwaGate), uint256(10))),
            "Web3ID RWAGate",
            address(rwaGate),
            attestations
        );
        payload.holderAuthorization.signature = hex"1234";

        vm.prank(holder);
        vm.expectRevert();
        rwaGate.buyRwa(payload, 10);
    }
}
