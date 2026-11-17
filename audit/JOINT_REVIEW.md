# Joint security review — ERC-8060 strict reference PR #1 vs TENIO Fragment historical PR #3

**Scope:** review the two draft pull requests **without merging either**, changing deployed code or moving ETH. This is not an independent professional audit.

- Strict reference: [`ten-io-meta/erc8060-native-eth-value` PR #1](https://github.com/ten-io-meta/erc8060-native-eth-value/pull/1)
- Archived deployed contract: [`ten-io-meta/TENIO-Fragment` PR #3](https://github.com/ten-io-meta/TENIO-Fragment/pull/3)
- Draft normative definition: `ten-io-meta/ERCs/ERCS/erc-8060.md`.

## Shared objective, materially different guarantees

| Property | Strict ERC-8060 reference, PR #1 | Historical TENIO Fragment, PR #3 |
| --- | --- | --- |
| Contract status | **Undeployed research reference**, code revision proposed | **Already deployed immutable historical contracts**; PR only adds audit scripts/tests/docs |
| Main interface | `valueOf(uint256)` and owner-only `burn(uint256)` | `burn(uint256)`; **no `valueOf(uint256)`** |
| ERC-165 | Strict `0x88495fe7` **true**; optional legacy query `0xcadf338f` **true** | Both strict and legacy `IERC721Value` IDs **false**; ERC721 true |
| Normal funded redemption | Exact token-backed ETH paid on successful burn | 0.10 ETH paid if contract has at least 0.10 ETH |
| **Insufficient ETH before burn** | **Reverts:** token and liability remain (fault-injection test, no public depletion route) | **Does not revert:** NFT is destroyed without payment (verified local counterexample) |
| ETH receiver rejects payment | Reverts the entire burn and restores ownership/accounting | Solidity `.transfer()` reverts when transfer attempted; can fail for contract wallets because of 2,300 gas stipend |
| Accounting | `totalRedeemableValue` liability and per-token `_redeemableValue` | No protocol-enforced outstanding-backing liability register |
| Privileged extraction | `withdrawSurplus(amount)` only up to balance minus outstanding liabilities | `withdraw()` can drain *entire* ETH balance, irrespective of live NFT owners |
| Reentrancy at redemption | `nonReentrant` and checks-effects-interactions; separate-token nested burn test | `.transfer()` gas stipend limits recipient behavior but does **not** provide modern backed-accounting guarantees |
| Source verification | Compiled/tested Solidity reference, not independently audited | Deployed **5,599 executable bytes** reproduced exactly from current source under solc 0.8.28, 200 optimizer runs, Cancun; **53 metadata bytes differ**, so not an exact full-runtime/source-metadata match |

## Test evidence and test limitations

### Strict reference
- Original 4 `// pendiente` tests were replaced with real assertions.
- Existing tests cover mint/transfer accounting, solvency, owner authorization, surplus, payment rollback and reentrant attack during payout.
- Additional local-only `hardhat_setBalance` fault injection models an abnormal underfunded state; `burn` must **revert while preserving the NFT and obligation**. This is intentionally not a claim that an attacker can reduce the real contract balance this way.
- Verified [51/51 on commit `e01a5d4`](https://github.com/ten-io-meta/erc8060-native-eth-value/actions/runs/44186278453) and [52/52 after adding fault injection](https://github.com/ten-io-meta/erc8060-native-eth-value/actions/runs/44195867883).

### Historical contract
- Verified [5/5 economic tests](https://github.com/ten-io-meta/TENIO-Fragment/actions/runs/44193922940) and exact **EVM executable** source-to-chain match on both Ethereum Mainnet and Sepolia.
- Read-only snapshot: Mainnet had `tokenIds() = 0`, no live NFTs and 0 ETH. Sepolia had 17 minted historical IDs, **live #14 and #15**, with 0.54 **test** ETH vs 0.20 expected for those two NFTs **at the inspected block**.
- Reported ETH margin on Sepolia **is not a protected surplus** because `withdraw()` can drain it.
- Onchain observations are historical point-in-time public-RPC reads, not a complete event-history investigation or a future solvency proof.
- Scripts include a further read-only `owner()` query to identify the administrator currently authorized to withdraw. **A README's claimed owner must not be mistaken for a current onchain access-control check.**

## Security findings and merge gates

**F1 (critical historical, proven):** `burn()` can destroy an NFT without paying when balance is below 0.10 ETH. This breaks strict ERC-8060 payment soundness; historical deployments cannot be patched from GitHub.

**F2 (critical historical, proven):** owner-only `withdraw()` can drain ETH backing of live NFTs. `onlyOwner` authorization is not bypassed; there is *no evidence of outsider theft* in this result.

**F3 (medium integration):** ERC-165 historical value-query ID only indicates a read-only method, **not** a valid strict `burn()`; strict profile must use `0x88495fe7`. Even strict `supportsInterface` is a self-declaration, **not proof of authenticated ETH provenance**.

**F4 (medium operability):** arbitrary smart-contract owner may not accept ETH. New strict contract preserves claims by reverting payout; the old `.transfer()` may fail due to its 2,300-gas stipend. This is a redemption-liveness constraint, not silent value loss in the funded branch.

**F5 (CI / research reliability):** historical live-RPC comparison depends on public endpoints that can return 429. Network failures must be recorded as **inconclusive**, not as security regressions or as proof of matching contracts; deterministic local tests remain independent evidence. Reruns should retain the exact block/commit/provider for reproducibility.

**F6 (provenance):** identical EVM executable prefixes establish behavior under the EVM but do not establish the original source-file metadata hash or prove all historical transactions were safe.

### Conditions before considering merges
1. **PR #1:** exact-head CI green, all additions reviewed, documentation makes strict/legacy ERC-165 split explicit. Merging source changes is **not authorization to deploy real money**; independent audit/fuzzing recommended.
2. **PR #3:** historical Solidity source unchanged; README clearly says historical burn is irreversible and conditional; exact-head local tests and runtime comparison documented, together with live owner/admin and token inventory, and any RPC inconclusive status honestly reported.
3. Maintain separate roles: old archival deployment != audited new strict implementation != conditional Reservable extension. Nothing here auto-upgrades/migrates historical holders.
4. Neither PR must depend on merging the other; cross-references are documentary.

## What has NOT been verified
- Formal invariants over every EVM transition, fuzzing over unbounded input sequences, third-party audit, consumer wallet/marketplace code and all external deployments.
- Current holdings beyond the block snapshots, original compiler metadata equality, deployment creation path or a full log-level reconstruction of historical transactions.
- Whether public forks, external `supportsInterface` claims or OECL verifier attestations are honest: ERC-165 is not an attestation of economic solvency.

**Decision recommended:** keep both draft until review findings and exact-head CI are checked. Do not merge, redeploy or attempt forced migration as a side effect of this review.
