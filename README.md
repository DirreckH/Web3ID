# Web3ID Role C (On-chain Adjudication)

Role C delivers the on-chain decision layer:
- Proof verifier interface (`bytes proof + uint256[] publicSignals`)
- Mock verifier for stage-1 integration
- RWA gate contract (verify -> allow action -> bookkeeping)
- Trust registry (issuer/verifier trust anchors)

## Project Structure

```text
src/
  interfaces/IProofVerifier.sol
  mocks/MockVerifier.sol
  RWAGate.sol
  TrustRegistry.sol
test/
  MockVerifier.t.sol
  RWAGate.t.sol
  TrustRegistry.t.sol
script/
  DeployLocal.s.sol
  DeploySepolia.s.sol
  InteractSepolia.s.sol
```

## 1) Windows Toolchain Setup (From Zero)

### Install Foundry binaries

```powershell
# Download a Windows Foundry release package and extract to %USERPROFILE%\.foundry\bin
$foundryBin = Join-Path $HOME '.foundry\bin'
New-Item -ItemType Directory -Force -Path $foundryBin | Out-Null
Invoke-WebRequest `
  -Uri 'https://github.com/foundry-rs/foundry/releases/download/v1.6.0-rc1/foundry_v1.6.0-rc1_win32_amd64.zip' `
  -OutFile "$env:TEMP\foundry_win32_amd64.zip"
Expand-Archive "$env:TEMP\foundry_win32_amd64.zip" -DestinationPath $foundryBin -Force
```

### Verify installation

```powershell
& "$HOME\.foundry\bin\forge.exe" --version
& "$HOME\.foundry\bin\cast.exe" --version
& "$HOME\.foundry\bin\anvil.exe" --version
```

If you already added Foundry to `PATH`, you can use `forge/cast/anvil` directly.

## 2) Environment Variables

Copy `.env.example` to `.env` and fill values:
- `PRIVATE_KEY`: deployer private key (use burner wallet for testnets)
- `SEPOLIA_RPC_URL`: Sepolia RPC endpoint
- `ETHERSCAN_API_KEY`: optional, for contract verification
- `RWA_GATE_ADDRESS`: for interaction script
- `BUY_AMOUNT`, `PASS_SIGNAL`: interaction inputs

## 3) Build and Test

```powershell
& "$HOME\.foundry\bin\forge.exe" build
& "$HOME\.foundry\bin\forge.exe" test -vv
```

## 4) Local End-to-End (Anvil)

### Start local chain

```powershell
& "$HOME\.foundry\bin\anvil.exe"
```

### Deploy contracts (new terminal)

```powershell
& "$HOME\.foundry\bin\forge.exe" script script/DeployLocal.s.sol:DeployLocalScript `
  --rpc-url http://127.0.0.1:8545 `
  --broadcast
```

### Verify success path (`publicSignals=[1]`)

```powershell
& "$HOME\.foundry\bin\cast.exe" send <RWA_GATE_ADDRESS> `
  "buyRwa(bytes,uint256[],uint256)" 0x1234 "[1]" 1 `
  --rpc-url http://127.0.0.1:8545 `
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

### Verify failure path (`publicSignals=[0]`)

```powershell
& "$HOME\.foundry\bin\cast.exe" call <RWA_GATE_ADDRESS> `
  "buyRwa(bytes,uint256[],uint256)" 0x1234 "[0]" 1 `
  --rpc-url http://127.0.0.1:8545
```

The call should revert with `ProofRejected()`.

## 5) Sepolia Deployment

```powershell
& "$HOME\.foundry\bin\forge.exe" script script/DeploySepolia.s.sol:DeploySepoliaScript `
  --rpc-url $env:SEPOLIA_RPC_URL `
  --broadcast
```

Optional verification:

```powershell
& "$HOME\.foundry\bin\forge.exe" script script/DeploySepolia.s.sol:DeploySepoliaScript `
  --rpc-url $env:SEPOLIA_RPC_URL `
  --broadcast `
  --verify `
  --etherscan-api-key $env:ETHERSCAN_API_KEY
```

## 6) Sepolia Interaction

### Success path

```powershell
& "$HOME\.foundry\bin\forge.exe" script script/InteractSepolia.s.sol:InteractSepoliaScript `
  --rpc-url $env:SEPOLIA_RPC_URL `
  --broadcast
```

### Failure path
Set `PASS_SIGNAL=0` then run the same command. It should revert with `ProofRejected()`.

## 7) Integration with Role B (Mock -> Real Verifier)

When Role B delivers real verifier artifacts:
1. Deploy Role B's verifier contract (or adapter implementing `IProofVerifier`).
2. Call `RWAGate.setVerifier(newVerifier)`.
3. Keep `RWAGate.buyRwa(bytes,uint256[],uint256)` unchanged.
4. Update client-side `publicSignals` index convention as required by Role B.
