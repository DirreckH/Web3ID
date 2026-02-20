// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MockVerifier} from "../src/mocks/MockVerifier.sol";
import {RWAGate} from "../src/RWAGate.sol";
import {TrustRegistry} from "../src/TrustRegistry.sol";

contract DeployLocalScript is Script {
    // Default Anvil account[0] private key.
    uint256 internal constant ANVIL_DEFAULT_PK = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

    function run() external returns (MockVerifier mockVerifier, RWAGate rwaGate, TrustRegistry trustRegistry) {
        uint256 privateKey = vm.envOr("PRIVATE_KEY", ANVIL_DEFAULT_PK);

        vm.startBroadcast(privateKey);
        mockVerifier = new MockVerifier();
        rwaGate = new RWAGate(address(mockVerifier));
        trustRegistry = new TrustRegistry();
        vm.stopBroadcast();
    }
}
