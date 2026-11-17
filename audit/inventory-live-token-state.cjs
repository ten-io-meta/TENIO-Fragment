"use strict";
// Read-only token inventory. No transactions, keys or credentials.
// tokenIds() is the observed mint counter; ownerOf reverts for burned tokens.
const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");
const entries = [
  { chainId: 1, name: "Ethereum Mainnet", rpc: "https://ethereum-rpc.publicnode.com",
    address: "0x7c88fabe05fd373d56a728f9896f87ede10db789" },
  { chainId: 11155111, name: "Sepolia", rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    address: "0xD360714b72796dC812A0c177B9Be45022D1f3f5B" }
];
const iface = new ethers.Interface([
  "function owner() view returns (address)",
  "function tokenIds() view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function supportsInterface(bytes4) view returns (bool)"
]);
let id = 0;
async function rpc(url, method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const resp = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }), signal: controller.signal });
    if (!resp.ok) throw Error("HTTP " + resp.status);
    const doc = await resp.json();
    if (doc.error) throw Error(String(doc.error.message || doc.error.code));
    return doc.result;
  } finally { clearTimeout(timer); }
}
async function view(entry, signature, args, block) {
  const data = iface.encodeFunctionData(signature, args);
  const bytes = await rpc(entry.rpc, "eth_call", [{ to: entry.address, data }, block]);
  if (!bytes || bytes === "0x") throw Error("EMPTY_RETURN");
  return iface.decodeFunctionResult(signature, bytes)[0];
}
(async () => {
  const results = [];
  let unavailable = false;
  for (const entry of entries) {
    const out = { ...entry, observedAt: new Date().toISOString() };
    try {
      const reportedChain = parseInt(await rpc(entry.rpc, "eth_chainId", []), 16);
      if (reportedChain !== entry.chainId) throw Error("CHAIN_MISMATCH");
      const head = parseInt(await rpc(entry.rpc, "eth_blockNumber", []), 16) - 3;
      const tag = "0x" + head.toString(16);
      const header = await rpc(entry.rpc, "eth_getBlockByNumber", [tag, false]);
      out.block = head;
      out.blockHash = header?.hash || null;
      out.balanceWei = BigInt(await rpc(entry.rpc, "eth_getBalance", [entry.address, tag])).toString();
      // The Ownable administrator controlling withdraw() is distinct from
      // the owners of individual NFTs; never infer it from the README.
      out.currentWithdrawalAdmin = await view(entry, "owner()", [], tag);
      const minted = await view(entry, "tokenIds()", [], tag);
      out.mintedCounter = minted.toString();
      const maximum = minted > 30n ? 30n : minted;
      out.scanComplete = maximum === minted;
      out.scanCap = Number(maximum);
      out.tokens = [];
      for (let i=1n; i<=maximum; i++) {
        try {
          const owner = await view(entry, "ownerOf(uint256)", [i], tag);
          out.tokens.push({ tokenId: i.toString(), exists: true, owner });
        } catch(e) {
          out.tokens.push({ tokenId: i.toString(), exists: false, evidence: "ownerOf reverted", error: String(e?.message || e).slice(0,80) });
        }
      }
      out.liveFound = out.tokens.filter(x=>x.exists).length;
      out.expectedRedemptionPerLiveTokenWei = "100000000000000000";
      out.minimumExpectedBackingForObservedLiveTokensWei =
        (BigInt(out.liveFound) * 100000000000000000n).toString();
      out.observedBalanceCoversScannedTokens =
        BigInt(out.balanceWei) >= BigInt(out.minimumExpectedBackingForObservedLiveTokensWei);
      out.caveat = "Expected economic redemption is inferred from matched executable code; the contract lacks a per-token enforceable backing register. Contract owner() identifies the current onlyOwner withdrawal administrator, distinct from ERC721 token owners. This is a snapshot and does not establish historical actions or future solvency.";
    } catch(e) {
      unavailable = true;
      out.status = "UNAVAILABLE";
      out.error = String(e?.message || e).slice(0,240);
    }
    if (!out.status) out.status = out.scanComplete ? "COMPLETE_MINTED_ID_SCAN" : "PARTIAL_MINTED_ID_SCAN";
    results.push(out);
    console.log("TOKEN_INVENTORY " + JSON.stringify(out));
  }
  const dir = path.resolve(__dirname, "results");
  fs.mkdirSync(dir, {recursive:true});
  fs.writeFileSync(path.join(dir,"token-inventory.json"),JSON.stringify(results,null,2)+"\n");
  if(unavailable) process.exitCode=1;
})().catch(e => {
  console.error("INVENTORY_FATAL",String(e.stack||e));
  process.exitCode=1;
});
