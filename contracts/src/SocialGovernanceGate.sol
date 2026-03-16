// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ComplianceVerifier} from "./ComplianceVerifier.sol";
import {AccessPayload} from "./interfaces/IComplianceVerifier.sol";

contract SocialGovernanceGate is Ownable, EIP712 {
    bytes32 public constant GOV_VOTE_POLICY_ID = keccak256("GOV_VOTE_V1");
    bytes32 public constant AIRDROP_POLICY_ID = keccak256("AIRDROP_ELIGIBILITY_V1");
    bytes32 public constant COMMUNITY_POST_POLICY_ID = keccak256("COMMUNITY_POST_V1");
    bytes32 internal constant HOLDER_AUTH_TYPEHASH = keccak256(
        "HolderAuthorization(bytes32 identityId,bytes32 subjectBinding,bytes32 policyId,bytes32 requestHash,uint256 chainId,uint256 nonce,uint256 deadline)"
    );

    ComplianceVerifier public verifier;
    mapping(address => mapping(uint256 => bool)) public nonceUsed;
    mapping(address => uint256) public voteCount;
    mapping(address => mapping(bytes32 => bool)) public airdropClaimed;
    mapping(address => uint256) public postCount;

    event VoteCast(address indexed voter, bytes32 indexed proposalId, bytes32 indexed identityId);
    event AirdropClaimed(address indexed claimant, bytes32 indexed roundId, bytes32 indexed identityId);
    event PostCreated(address indexed author, bytes32 indexed postRef, bytes32 indexed identityId);

    error AuthorizationExpired();
    error InvalidAuthorization();
    error InvalidAccess();
    error NonceAlreadyUsed();
    error AlreadyClaimed();

    constructor(address verifier_) Ownable(msg.sender) EIP712("Web3ID Social Governance", "2") {
        verifier = ComplianceVerifier(verifier_);
    }

    function vote(AccessPayload calldata payload, bytes32 proposalId) external {
        _verifyHolderAuthorization(payload, GOV_VOTE_POLICY_ID, keccak256(abi.encodePacked("VOTE", address(this), proposalId)));
        if (!verifier.verifyAccess(GOV_VOTE_POLICY_ID, payload)) revert InvalidAccess();

        nonceUsed[msg.sender][payload.holderAuthorization.nonce] = true;
        voteCount[msg.sender] += 1;
        emit VoteCast(msg.sender, proposalId, payload.identityId);
    }

    function claimAirdrop(AccessPayload calldata payload, bytes32 roundId) external {
        _verifyHolderAuthorization(
            payload, AIRDROP_POLICY_ID, keccak256(abi.encodePacked("CLAIM_AIRDROP", address(this), roundId))
        );
        if (!verifier.verifyAccess(AIRDROP_POLICY_ID, payload)) revert InvalidAccess();
        if (airdropClaimed[msg.sender][roundId]) revert AlreadyClaimed();

        nonceUsed[msg.sender][payload.holderAuthorization.nonce] = true;
        airdropClaimed[msg.sender][roundId] = true;
        emit AirdropClaimed(msg.sender, roundId, payload.identityId);
    }

    function createPost(AccessPayload calldata payload, bytes32 postRef) external {
        _verifyHolderAuthorization(
            payload, COMMUNITY_POST_POLICY_ID, keccak256(abi.encodePacked("CREATE_POST", address(this), postRef))
        );
        if (!verifier.verifyAccess(COMMUNITY_POST_POLICY_ID, payload)) revert InvalidAccess();

        nonceUsed[msg.sender][payload.holderAuthorization.nonce] = true;
        postCount[msg.sender] += 1;
        emit PostCreated(msg.sender, postRef, payload.identityId);
    }

    function _verifyHolderAuthorization(AccessPayload calldata payload, bytes32 expectedPolicyId, bytes32 requestHash)
        internal
        view
    {
        if (payload.holderAuthorization.deadline < block.timestamp) revert AuthorizationExpired();
        if (nonceUsed[msg.sender][payload.holderAuthorization.nonce]) revert NonceAlreadyUsed();
        if (payload.holderAuthorization.requestHash != requestHash) revert InvalidAuthorization();
        if (payload.holderAuthorization.policyId != expectedPolicyId) revert InvalidAuthorization();
        if (payload.holderAuthorization.chainId != block.chainid) revert InvalidAuthorization();

        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    HOLDER_AUTH_TYPEHASH,
                    payload.holderAuthorization.identityId,
                    payload.holderAuthorization.subjectBinding,
                    payload.holderAuthorization.policyId,
                    payload.holderAuthorization.requestHash,
                    payload.holderAuthorization.chainId,
                    payload.holderAuthorization.nonce,
                    payload.holderAuthorization.deadline
                )
            )
        );

        address signer = ECDSA.recover(digest, payload.holderAuthorization.signature);
        if (signer != msg.sender) revert InvalidAuthorization();
    }
}
