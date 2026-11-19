# TENIO Fragment historical source: economic security analysis (pending exact bytecode attestation)

**Status:** published source reviewed; deployed code identity NOT YET established by a successful exact-runtime comparison. Do not treat this as an onchain exploit claim.

## Scope and invariants

Published source: `contracts/TENIOFragment.sol`, Solidity `^0.8.25`, imports OpenZeppelin 5.3.0, configured compiler 0.8.28. Each mint charges **0.12 ETH**; expected burn redemption is **0.10 ETH**. A safe backed-token design must preserve at least `0.10 ether * liveSupply` in a protected reserve (or track actual per-token backing), and ensure a token cannot be destroyed without either its promised payment or a full transaction revert.

This source does **not** track live liabilities or per-token backing. It has no `valueOf(uint256)` and does not advertise strict ERC-8060.

## Findings, assuming published source equals deployed runtime

### F-01: successful burn without redemption when balance < 0.10 ETH — HIGH
```solidity
_burn(tokenId);
uint256 balance = address(this).balance;
if (balance >= 0.10 ether) {
    payable(msg.sender).transfer(0.10 ether);
}
```
If the caller owns a live NFT and contract balance is below 0.10 ETH, the NFT is burned and the call **succeeds without any ETH payment**. The caller loses their NFT claim. This is distinct from a `transfer` that reverts because the recipient rejects ETH: that revert undoes the whole transaction, including `_burn`.

**Adversarial sequence:** owner mints one NFT with 0.12 ETH; contract owner withdraws the entire balance; NFT owner calls `burn(1)`; burn succeeds, ownerOf(1) reverts, ETH paid = 0.

### F-02: owner can drain all funds including claimed collateral — CRITICAL for financial reliance
```solidity
function withdraw() public onlyOwner {
    payable(owner()).transfer(address(this).balance);
}
```
There is no deduction for outstanding backing liabilities. An authorized contract owner can withdraw all ETH while any number of NFTs remain outstanding. Even if intended only as a surplus withdrawal, the code does not enforce that policy. This is an **owner-authorized reserve drain**, not an unrestricted external attacker exploit.

**Adversarial sequence:** mint NFT for 0.12 ETH, owner calls `withdraw()` (0.12 ETH), NFT stays alive but contract has 0 ETH; the holder cannot receive promised 0.10 ETH. If the holder then burns, F-01 destroys the token without payout.

### F-03: payout via `transfer` may reject legitimate contract wallets — MEDIUM
The fixed 2300-gas stipend can cause payment to fail for contract-based owners with nontrivial `receive()`/fallback logic. Here failure reverts the full burn (so token is preserved), but the owner may be unable to redeem without transferring the NFT to a compatible address. Not a no-payout burn.

### F-04: no per-token value or ERC-165 strict identity — compatibility limitation
The historical contract has `burn(uint256)` but lacks `valueOf(uint256)`. It cannot truthfully advertise `IERC721Value` without implementing the full interface and solvency guarantees. The live onchain audit reports both ERC-165 IDs as `false` for Mainnet and Sepolia.

## Prior observed onchain state (separate read-only PR)

- Mainnet Fragment `0x7c88fabe05fd373d56a728f9896f87ede10db789`: 0 ETH at the previously observed block.
- Sepolia Fragment `0xD360714b72796dC812A0c177B9Be45022D1f3f5B`: 0.54 ETH of test ETH at that block.
- Both have exactly the same deployed runtime code hash `0xb74b67250e0c7b4eeefbc8dcb1ede2a21c126ac0fb9f451e9a7479185459a68d`.
- **Zero ETH in Mainnet is not proof that any NFT is currently live**. Establish token supply and ownerOf(tokenIds), historical Mint/Transfer events and withdrawals before alleging losses or insolvency.

## Safe next steps

1. Reproduce **exact deployed runtime** from verified source, compiler version, optimizer, evmVersion, metadata, and linked libraries. Compare full bytecode, not merely selector names or metadata-stripped bytecode. Audit script and CI are in this PR.
2. Once source identity is proven, reproduce F-01/F-02 in a **local Hardhat test** (or state-pinned fork) with a live NFT. Test both failed and successful burn paths.
3. Investigate Mainnet historical state and transaction events: who minted, whether NFTs remain live, and what `withdraw` actually did. Never assume 0 ETH proves any particular action.
4. **Do not send more ETH, mint, burn or withdraw as a test on Mainnet.** If an actual live backing deficit is found, disclose to relevant holders and consider a separately reviewed migration/new safe contract; an immutable old contract cannot be repaired by editing GitHub.
5. Keep strict ERC-8060 reference and OECL research **separate**. Do not retroactively describe historical Fragment as strict ERC-8060.

No change to the published Solidity contract is proposed in this PR.
