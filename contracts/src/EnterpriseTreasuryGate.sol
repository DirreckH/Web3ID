// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ComplianceVerifier} from "./ComplianceVerifier.sol";
import {AccessPayload} from "./interfaces/IComplianceVerifier.sol";

contract EnterpriseTreasuryGate is Ownable, EIP712 {
    bytes32 public constant PAYMENT_POLICY_ID = keccak256("ENTITY_PAYMENT_V1");
    bytes32 public constant AUDIT_POLICY_ID = keccak256("ENTITY_AUDIT_V1");
    bytes32 internal constant HOLDER_AUTH_TYPEHASH = keccak256(
        "HolderAuthorization(bytes32 identityId,bytes32 subjectBinding,bytes32 policyId,bytes32 requestHash,uint256 chainId,uint256 nonce,uint256 deadline)"
    );

    struct PaymentRecord {
        address initiator;
        address beneficiary;
        uint256 amount;
        bytes32 paymentRef;
        uint256 timestamp;
    }

    ComplianceVerifier public verifier;
    mapping(address => mapping(uint256 => bool)) public nonceUsed;
    PaymentRecord[] public payments;

    event PaymentSubmitted(address indexed initiator, address indexed beneficiary, uint256 amount, bytes32 paymentRef);
    event AuditRecordExported(address indexed initiator, bytes32 auditRef);

    error AuthorizationExpired();
    error InvalidAuthorization();
    error InvalidAccess();
    error NonceAlreadyUsed();

    constructor(address verifier_) Ownable(msg.sender) EIP712("Web3ID Enterprise Treasury", "2") {
        verifier = ComplianceVerifier(verifier_);
    }

    function submitPayment(AccessPayload calldata payload, address beneficiary, uint256 amount, bytes32 paymentRef) external {
        _verifyHolderAuthorization(payload, PAYMENT_POLICY_ID, keccak256(abi.encodePacked("PAYMENT", address(this), beneficiary, amount, paymentRef)));
        if (!verifier.verifyAccess(PAYMENT_POLICY_ID, payload)) revert InvalidAccess();

        nonceUsed[msg.sender][payload.holderAuthorization.nonce] = true;
        payments.push(
            PaymentRecord({
                initiator: msg.sender,
                beneficiary: beneficiary,
                amount: amount,
                paymentRef: paymentRef,
                timestamp: block.timestamp
            })
        );
        emit PaymentSubmitted(msg.sender, beneficiary, amount, paymentRef);
    }

    function exportAuditRecord(AccessPayload calldata payload, bytes32 auditRef) external {
        _verifyHolderAuthorization(payload, AUDIT_POLICY_ID, keccak256(abi.encodePacked("AUDIT", address(this), auditRef)));
        if (!verifier.verifyAccess(AUDIT_POLICY_ID, payload)) revert InvalidAccess();

        nonceUsed[msg.sender][payload.holderAuthorization.nonce] = true;
        emit AuditRecordExported(msg.sender, auditRef);
    }

    function paymentCount() external view returns (uint256) {
        return payments.length;
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
