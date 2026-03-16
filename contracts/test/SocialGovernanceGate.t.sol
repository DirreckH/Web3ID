// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessPayload, CredentialAttestationInput, IdentityState} from "../src/interfaces/IComplianceVerifier.sol";
import {SocialGovernanceGate} from "../src/SocialGovernanceGate.sol";
import {Phase2TestBase} from "./helpers/Phase2TestBase.sol";

contract SocialGovernanceGateTest is Phase2TestBase {
    function setUp() external {
        setUpBase();
    }

    function testVotePassesWithoutCredentials() external {
        bytes32 proposalId = keccak256("proposal-1");
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](0);
        AccessPayload memory payload = buildPayload(
            GOV_VOTE_POLICY_ID,
            keccak256(abi.encodePacked("VOTE", address(socialGate), proposalId)),
            "Web3ID Social Governance",
            address(socialGate),
            attestations
        );

        vm.prank(holder);
        socialGate.vote(payload, proposalId);

        assertEq(socialGate.voteCount(holder), 1);
    }

    function testVoteRejectsNonNormalState() external {
        bytes32 proposalId = keccak256("proposal-1");
        stateRegistry.setState(identityId, IdentityState.OBSERVED, keccak256("observe"), 2);
        CredentialAttestationInput[] memory attestations = new CredentialAttestationInput[](0);
        AccessPayload memory payload = buildPayload(
            GOV_VOTE_POLICY_ID,
            keccak256(abi.encodePacked("VOTE", address(socialGate), proposalId)),
            "Web3ID Social Governance",
            address(socialGate),
            attestations
        );

        vm.prank(holder);
        vm.expectRevert();
        socialGate.vote(payload, proposalId);
    }
}
