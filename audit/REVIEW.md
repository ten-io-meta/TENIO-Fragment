# TENIO Fragment — deployed runtime provenance and redemption risk review

Status: experimental audit. This analysis does not send ETH, deploy new contracts, or modify any deployed contract.

## Target deployments

- Ethereum Mainnet: `0x7c88fabe05fd373d56a728f9896f87ede10db789`
- Sepolia: `0xD360714b72796dC812A0c177B9Be45022D1f3f5B`
- Previously established both at runtime hash `0xb74b67250e0c7b4eeefbc8dcb1ede2a21c126ac0fb9f451e9a7479185459a68d`, 5,652 bytes.

## Matching process (not just ABI comparison)

Recompile repository source `contracts/TENIOFragment.sol` with locked `@openzeppelin/contracts` v5 and Solidity 0.8.28.

| Compiler configuration | Result |
| --- | --- |
| Optimizer off, EVM Paris | 10,937 runtime bytes; **does not match** |
| Optimizer on, 200 runs, EVM Paris | 5,828 runtime bytes; **does not match** |
| Optimizer on, 200 runs, EVM Cancun | **5,652 runtime bytes; executable prefix matches** deployments |

With Cancun compilation, **the runtime executable code excluding compiler CBOR metadata is byte-for-byte identical** to both chain deployments. The Solidity CBOR tail is 51 bytes plus a 2-byte length suffix; those **53 metadata bytes differ**, so the entire deployed bytecode and compiler metadata are **not** an exact full match. Do not describe this as proof of identical source-file checksums or deployment inputs.

The comparison script independently fetches `eth_getCode`, `eth_getBlockByNumber` and `eth_getBalance` from two chain-specific providers, pins one block, checks expected keccak hashes and reports **full code equality** separately from **executable-prefix equality**. The GitHub Action fails closed when executable-prefix equality or code/provenance agreement cannot be established.

## Economic properties, specified vs observed

**R1 — Payment soundness (strict ERC-8060 expectation)**

For every existing token with advertised recoverable value `v`:

`successful burn(tokenId) => token destroyed AND caller receives v ETH`

Source has no `valueOf()`; `burn(tokenId)` uses:

```solidity
_burn(tokenId);
if (address(this).balance >= 0.10 ether) {
    payable(msg.sender).transfer(0.10 ether);
}
```

If balance is less than `0.10 ETH`, the conditional payment is omitted but the transaction **succeeds** and token ownership is destroyed. An EVM transaction does not revert automatically just because an `if` condition is false.

**R2 — Reserve preservation under owner withdrawal**

`withdraw()` is `onlyOwner`, not permissionless, but calls `transfer(address(this).balance)` without tracking outstanding token obligations. A privileged admin may empty the pooled ETH even while holders own unburned tokens. This is a trust/security boundary, not evidence that an attacker can bypass `onlyOwner`.

**R3 — Failure behavior of `.transfer()`**

When funds are sufficient but the destination contract cannot accept the 2,300-gas stipend, Solidity `.transfer()` reverts and the entire `burn()` state transition reverts. This is better than destroying tokens silently in the sufficient-funds branch, but introduces compatibility/liveness limitations for smart-contract wallets. `call` plus proper checks-effects-interactions/nonReentrant is the more flexible payout pattern in the new strict reference.

**R4 — Introspection**

`supportsInterface(0x88495fe7)` and `supportsInterface(0xcadf338f)` return false in both deployed TENIO Fragment contracts. They advertise ERC721 and ERC165, not strict `IERC721Value`. Historical attribution must not imply current ERC-8060 compliance.

## Local proof tests

`npx hardhat test --config audit/hardhat.audit.config.cjs` checks:
1. Normal 0.12 ETH mint / 0.10 ETH burn payout.
2. Owner withdrawal while an NFT remains live, then **successful zero-payout burn**.
3. Owner draining the backing of two independently owned NFTs.
4. A 0.05 ETH partial refund below promised redemption followed by successful zero-payout burn.
5. ERC165 / ERC721 yes; both strict and legacy IERC721Value IDs no.

Tests are local EVM reproductions only; no real wallet signatures or onchain state mutations.

## Operational impact and safe remediation

- **Do not label the original historical deployments as full ERC-8060-compliant redeemable-backed NFTs.**
- The contract code is immutable for these known deployments; editing this repository **cannot patch them**.
- Treat any live-token outstanding obligations as *not guaranteed by protocol accounting*. Inspect `tokenIds()`, ownerOf for each minted token and live balance to determine whether an actual outstanding owner or funding deficit exists. Inventory is evidence, not a proof of current user losses.
- A future replacement should hold the sum of redeemable per-token obligations as reserved capital and check `balance >= outstandingBacking` on mint/surplus withdrawal. `burn` MUST revert on inadequate ETH, remove token obligation before calling out, restore everything if the transfer fails, and be covered by adversarial tests.
- Existing ERC-8060 strict reference research includes those controls and must be independently reviewed before any new real-money use.
- **Do not create an unreviewed owner-driven migration/forced burn:** existing holders should remain in control of their NFTs. Any replacement requires transparent opt-in migration, clear funds provenance and independent security review.
- Zero ETH at a historical Mainnet snapshot is **not sufficient by itself to prove users lost money**: live minted IDs and historical transactions must be examined separately.

## Limitations

A matching executable prefix proves that locally reproduced **runtime EVM instructions** coincide with those deployed, not the source-file metadata fingerprint, original compiler input or transaction history. No security audit can rule out every vulnerability; targeted tests demonstrate concrete counterexamples, not a full formal verification of all states.
