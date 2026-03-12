// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IdentityState} from "./interfaces/IComplianceVerifier.sol";

contract IdentityStateRegistry is AccessControl {
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    struct StateSnapshot {
        IdentityState state;
        bytes32 reasonCode;
        uint256 version;
        uint256 updatedAt;
    }

    mapping(bytes32 => StateSnapshot) internal stateSnapshots;

    event StateTransitioned(
        bytes32 indexed identityId,
        IdentityState indexed fromState,
        IdentityState indexed toState,
        bytes32 reasonCode,
        uint256 version,
        address actor
    );
    event GovernanceAction(address indexed actor, bytes32 indexed action, bytes32 indexed target, bytes32 reason, uint256 version);

    error IllegalTransition(IdentityState fromState, IdentityState toState);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(RISK_MANAGER_ROLE, msg.sender);
        _grantRole(AUDITOR_ROLE, msg.sender);
    }

    function setState(bytes32 identityId, IdentityState nextState, bytes32 reasonCode, uint256 version)
        external
        onlyRole(RISK_MANAGER_ROLE)
    {
        _setState(identityId, nextState, reasonCode, version);
    }

    function freeze(bytes32 identityId, bytes32 reasonCode, uint256 version) external onlyRole(RISK_MANAGER_ROLE) {
        _setState(identityId, IdentityState.FROZEN, reasonCode, version);
    }

    function unfreeze(bytes32 identityId, IdentityState nextState, bytes32 reasonCode, uint256 version)
        external
        onlyRole(RISK_MANAGER_ROLE)
    {
        _setState(identityId, nextState, reasonCode, version);
    }

    function _setState(bytes32 identityId, IdentityState nextState, bytes32 reasonCode, uint256 version) internal {
        IdentityState currentState = getState(identityId);
        if (!_canTransition(currentState, nextState) && currentState != nextState) {
            revert IllegalTransition(currentState, nextState);
        }

        stateSnapshots[identityId] = StateSnapshot({
            state: nextState,
            reasonCode: reasonCode,
            version: version,
            updatedAt: block.timestamp
        });

        emit StateTransitioned(identityId, currentState, nextState, reasonCode, version, msg.sender);
        emit GovernanceAction(msg.sender, keccak256("SET_STATE"), identityId, reasonCode, version);
    }

    function getState(bytes32 identityId) public view returns (IdentityState) {
        StateSnapshot memory snapshot = stateSnapshots[identityId];
        if (snapshot.updatedAt == 0) {
            return IdentityState.INIT;
        }

        return snapshot.state;
    }

    function getStateSnapshot(bytes32 identityId)
        external
        view
        returns (IdentityState state, bytes32 reasonCode, uint256 version, uint256 updatedAt)
    {
        StateSnapshot memory snapshot = stateSnapshots[identityId];
        if (snapshot.updatedAt == 0) {
            return (IdentityState.INIT, bytes32(0), 0, 0);
        }

        return (snapshot.state, snapshot.reasonCode, snapshot.version, snapshot.updatedAt);
    }

    function _canTransition(IdentityState fromState, IdentityState toState) internal pure returns (bool) {
        if (fromState == IdentityState.INIT) {
            return
                toState == IdentityState.NORMAL || toState == IdentityState.OBSERVED || toState == IdentityState.RESTRICTED
                    || toState == IdentityState.FROZEN;
        }
        if (fromState == IdentityState.NORMAL) {
            return
                toState == IdentityState.OBSERVED || toState == IdentityState.RESTRICTED
                    || toState == IdentityState.HIGH_RISK || toState == IdentityState.FROZEN;
        }
        if (fromState == IdentityState.OBSERVED) {
            return
                toState == IdentityState.NORMAL || toState == IdentityState.RESTRICTED
                    || toState == IdentityState.HIGH_RISK || toState == IdentityState.FROZEN;
        }
        if (fromState == IdentityState.RESTRICTED) {
            return toState == IdentityState.OBSERVED || toState == IdentityState.HIGH_RISK || toState == IdentityState.FROZEN;
        }
        if (fromState == IdentityState.HIGH_RISK) {
            return toState == IdentityState.RESTRICTED || toState == IdentityState.FROZEN;
        }
        if (fromState == IdentityState.FROZEN) {
            return toState == IdentityState.RESTRICTED || toState == IdentityState.HIGH_RISK;
        }
        return false;
    }
}
