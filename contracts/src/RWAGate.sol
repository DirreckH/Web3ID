// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ComplianceVerifier} from "./ComplianceVerifier.sol";
import {MockRWAAsset} from "./MockRWAAsset.sol";
import {AccessPayload} from "./interfaces/IComplianceVerifier.sol";

contract RWAGate is Ownable, EIP712 {
    bytes32 public constant RWA_POLICY_ID = keccak256("RWA_BUY_V2");
    bytes32 internal constant HOLDER_AUTH_TYPEHASH = keccak256(
        "HolderAuthorization(bytes32 identityId,bytes32 subjectBinding,bytes32 policyId,bytes32 requestHash,uint256 chainId,uint256 nonce,uint256 deadline)"
    );

    ComplianceVerifier public verifier;
    MockRWAAsset public asset;
    mapping(address => uint256) public purchasedAmount;
    mapping(address => mapping(uint256 => bool)) public nonceUsed;

    event RwaPurchased(address indexed buyer, bytes32 indexed identityId, uint256 amount);
    event VerifierUpdated(address indexed oldVerifier, address indexed newVerifier);
    event AssetUpdated(address indexed oldAsset, address indexed newAsset);

    error InvalidAmount();
    error InvalidVerifier();
    error InvalidAsset();
    error InvalidAuthorization();
    error AuthorizationExpired();
    error NonceAlreadyUsed();
    error InvalidAccess();

    constructor(address verifier_, address asset_) Ownable(msg.sender) EIP712("Web3ID RWAGate", "2") {
        _setVerifier(verifier_);
        _setAsset(asset_);
    }

    function buyRwa(AccessPayload calldata payload, uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        _verifyHolderAuthorization(payload, _requestHash(amount));
        if (!verifier.verifyAccess(RWA_POLICY_ID, payload)) revert InvalidAccess();

        nonceUsed[msg.sender][payload.holderAuthorization.nonce] = true;
        purchasedAmount[msg.sender] += amount;
        asset.mint(msg.sender, amount);
        emit RwaPurchased(msg.sender, payload.identityId, amount);
    }

    function setVerifier(address verifier_) external onlyOwner {
        _setVerifier(verifier_);
    }

    function setAsset(address asset_) external onlyOwner {
        _setAsset(asset_);
    }

    function _setVerifier(address verifier_) internal {
        if (verifier_ == address(0)) revert InvalidVerifier();
        address oldVerifier = address(verifier);
        verifier = ComplianceVerifier(verifier_);
        emit VerifierUpdated(oldVerifier, verifier_);
    }

    function _setAsset(address asset_) internal {
        if (asset_ == address(0)) revert InvalidAsset();
        address oldAsset = address(asset);
        asset = MockRWAAsset(asset_);
        emit AssetUpdated(oldAsset, asset_);
    }

    function _verifyHolderAuthorization(AccessPayload calldata payload, bytes32 requestHash) internal view {
        if (payload.holderAuthorization.deadline < block.timestamp) revert AuthorizationExpired();
        if (nonceUsed[msg.sender][payload.holderAuthorization.nonce]) revert NonceAlreadyUsed();
        if (payload.holderAuthorization.requestHash != requestHash) revert InvalidAuthorization();
        if (payload.holderAuthorization.policyId != RWA_POLICY_ID) revert InvalidAuthorization();
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

    function _requestHash(uint256 amount) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("BUY_RWA", address(this), amount));
    }
}
