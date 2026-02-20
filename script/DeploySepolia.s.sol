// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MockVerifier} from "../src/mocks/MockVerifier.sol";
import {RWAGate} from "../src/RWAGate.sol";
import {TrustRegistry} from "../src/TrustRegistry.sol";

contract DeploySepoliaScript is Script {
    function run() external returns (MockVerifier mockVerifier, RWAGate rwaGate, TrustRegistry trustRegistry) {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(privateKey);
        mockVerifier = new MockVerifier();
        rwaGate = new RWAGate(address(mockVerifier));
        trustRegistry = new TrustRegistry();
        vm.stopBroadcast();
    }
}
