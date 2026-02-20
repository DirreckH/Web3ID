// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {RWAGate} from "../src/RWAGate.sol";

contract InteractSepoliaScript is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address rwaGateAddress = vm.envAddress("RWA_GATE_ADDRESS");
        uint256 amount = vm.envOr("BUY_AMOUNT", uint256(1));
        uint256 passSignal = vm.envOr("PASS_SIGNAL", uint256(1));

        bytes memory proof = hex"1234";
        uint256[] memory publicSignals = new uint256[](1);
        publicSignals[0] = passSignal;

        vm.startBroadcast(privateKey);
        RWAGate(rwaGateAddress).buyRwa(proof, publicSignals, amount);
        vm.stopBroadcast();
    }
}
