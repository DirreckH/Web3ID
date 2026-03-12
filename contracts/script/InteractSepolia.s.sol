// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TrustRegistry} from "../src/TrustRegistry.sol";

contract InteractSepoliaScript is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address trustRegistryAddress = vm.envAddress("TRUST_REGISTRY_ADDRESS");
        address trustedIssuer = vm.envAddress("TRUSTED_ISSUER");
        bytes32 revokedCredential = vm.envOr("REVOKED_CREDENTIAL", bytes32(0));

        vm.startBroadcast(privateKey);

        if (trustedIssuer != address(0)) {
            TrustRegistry(trustRegistryAddress).addTrustedIssuer(trustedIssuer);
            console2.log("Trusted issuer added:", trustedIssuer);
        }

        if (revokedCredential != bytes32(0)) {
            TrustRegistry(trustRegistryAddress).revokeCredential(revokedCredential);
            console2.logBytes32(revokedCredential);
        }

        vm.stopBroadcast();
    }
}
