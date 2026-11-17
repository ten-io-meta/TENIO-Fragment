"use strict";

// Verifies original TENIOFragment Solidity source vs *deployed runtime*, read-only.
// Usage: node audit/compare-deployments.cjs (after npx hardhat compile --config audit/hardhat.audit.config.cjs)
const fs = require("node:fs");
const path = require("node:path");
const { ethers } = require("ethers");

const artifactPath = path.resolve(__dirname, "artifacts/contracts/TENIOFragment.sol/TENIOFragment.json");
const buildInfoDir = path.resolve(__dirname, "artifacts/build-info");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
const compiled = artifact.deployedBytecode.toLowerCase();
const expectedChainHashes = {
  1: "0xb74b67250e0c7b4eeefbc8dcb1ede2a21c126ac0fb9f451e9a7479185459a68d",
  11155111: "0xb74b67250e0c7b4eeefbc8dcb1ede2a21c126ac0fb9f451e9a7479185459a68d"
};
const networks = [
  {
    chain: 1,
    name: "Ethereum Mainnet",
    address: "0x7c88fabe05fd373d56a728f9896f87ede10db789",
    providers: ["https://ethereum-rpc.publicnode.com", "https://eth.drpc.org"]
  },
  {
    chain: 11155111,
    name: "Sepolia",
    address: "0xD360714b72796dC812A0c177B9Be45022D1f3f5B",
    providers: [
      "https://ethereum-sepolia-rpc.publicnode.com",
      "https://1rpc.io/sepolia",
      "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
      "https://sepolia.gateway.tenderly.co",
      "https://rpc.sepolia.org",
      "https://rpc2.sepolia.org"
    ]
  }
];

let reqId = 0;
async function rpc(url, method, params, timeout = 10000) {
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), timeout);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++reqId, method, params }),
      signal: ctrl.signal
    });
    if (!response.ok) throw Error("HTTP " + response.status);
    const res = await response.json();
    if (res.error) throw Error("RPC error " + res.error.code + ": " + String(res.error.message).slice(0, 150));
    if (!("result" in res)) throw Error("Missing RPC result");
    return res.result;
  } finally {
    clearTimeout(tm);
  }
}

function runtimeWithoutSolidityCBOR(hex) {
  // Solidity appends a CBOR metadata blob and its uint16 byte length.
  // Compare executable code independently of metadata only as a *secondary*
  // diagnostic; a matching executable prefix is NOT an exact full-byte match.
  if (typeof hex !== "string" || !/^0x[0-9a-f]*$/i.test(hex) || hex.length < 10) return null;
  const metadataLength = parseInt(hex.slice(-4), 16);
  const bytes = (hex.length - 2) / 2;
  if (metadataLength <= 0 || metadataLength + 2 >= bytes || metadataLength > 300) return null;
  return hex.slice(0, hex.length - (metadataLength + 2) * 2).toLowerCase();
}

const compilations = fs.existsSync(buildInfoDir) ?
  fs.readdirSync(buildInfoDir).filter(x => x.endsWith(".json")).map(x => {
    const bi = JSON.parse(fs.readFileSync(path.join(buildInfoDir, x), "utf8"));
    return { filename: x, solcVersion: bi.solcVersion,
      solcLongVersion: bi.solcLongVersion,
      settings: bi.input?.settings,
      source: bi.input?.sources?.["contracts/TENIOFragment.sol"]?.content };
  }) : [];

const result = {
  title: "TENIO_FRAGMENT_DEPLOYED_RUNTIME_SOURCE_COMPARISON_V1",
  performedAt: new Date().toISOString(),
  gitSource: "ten-io-meta/TENIO-Fragment contracts/TENIOFragment.sol",
  compiler: compilations.map(c => ({
    version: c.solcVersion,
    longVersion: c.solcLongVersion,
    optimizer: c.settings?.optimizer,
    evmVersion: c.settings?.evmVersion,
    metadata: c.settings?.metadata,
    sourceIncluded: typeof c.source === "string"
  })),
  compiled: {
    runtimeBytes: (compiled.length - 2) / 2,
    runtimeKeccak256: ethers.keccak256(compiled),
    compilerArtifact: path.relative(process.cwd(), artifactPath)
  },
  deployments: []
};

(async () => {
  let good = true;
  const compiledLogic = runtimeWithoutSolidityCBOR(compiled);

  for (const net of networks) {
    const readings = [];
    for (const url of net.providers) {
      try {
        const chain = parseInt(await rpc(url, "eth_chainId", []), 16);
        if (chain !== net.chain) throw Error("Wrong chain: " + chain);
        const head = parseInt(await rpc(url, "eth_blockNumber", []), 16);
        readings.push({ url, head });
      } catch (e) {
        readings.push({ url, error: String(e.message || e) });
      }
    }
    const available = readings.filter(x => Number.isInteger(x.head));
    if (!available.length) {
      good = false;
      result.deployments.push({ ...net, status: "RPC_UNAVAILABLE", providers: readings });
      continue;
    }
    const height = Math.min(...available.map(x => x.head)) - 3;
    const blockTag = "0x" + height.toString(16);
    const observations = [];
    const providerErrors = [];
    const distinctObservedEndpoints = new Set();

    for (const node of available) {
      if (distinctObservedEndpoints.has(node.url)) continue;
      try {
        const code = (await rpc(node.url, "eth_getCode", [net.address, blockTag])).toLowerCase();
        const head = await rpc(node.url, "eth_getBlockByNumber", [blockTag, false]);
        const balance = await rpc(node.url, "eth_getBalance", [net.address, blockTag]);
        const logic = runtimeWithoutSolidityCBOR(code);
        const obs = {
          endpoint: node.url, block: height, blockHash: head?.hash || null,
          byteCount: (code.length - 2) / 2,
          keccak256: code === "0x" ? null : ethers.keccak256(code),
          balanceWei: BigInt(balance).toString(),
          fullRuntimeExactMatch: code === compiled,
          executablePrefixAfterCBORMatches: logic !== null && compiledLogic !== null && logic === compiledLogic,
          cborLength: code.length > 6 ? parseInt(code.slice(-4), 16) : null
        };
        observations.push(obs);
        distinctObservedEndpoints.add(node.url);
        if (observations.length >= 2) break; // two distinct successful RPCs
      } catch (e) {
        providerErrors.push({ endpoint: node.url, error: String(e.message || e) });
      }
    }

    const complete = observations.length === 2 && observations.every(x => x.keccak256);
    const agree = complete &&
      observations[0].keccak256 === observations[1].keccak256 &&
      observations[0].blockHash === observations[1].blockHash &&
      observations[0].balanceWei === observations[1].balanceWei;
    const expectedHashMatch = complete && observations.every(x => x.keccak256 === expectedChainHashes[net.chain]);

    const allExact = complete && observations.every(x => x.fullRuntimeExactMatch);
    const allExecutableMatch = complete && observations.every(x => x.executablePrefixAfterCBORMatches);
    const status = !complete ? "INCOMPLETE" : !agree ? "PROVIDER_DIVERGENCE" :
      allExact ? "FULL_BYTE_FOR_BYTE_MATCH" :
      allExecutableMatch ? "EXECUTABLE_CODE_MATCH_ONLY_METADATA_DIFFERS" :
      "COMPILED_RUNTIME_MISMATCH";
    // For behavior/security analysis, Solidity's executable runtime is the
    // binding criterion. Full metadata mismatch remains a recorded limitation:
    // it is NOT evidence of exact source-file or compiler-input provenance.
    if (!allExecutableMatch || !agree || !expectedHashMatch) good = false;
    const report = {
      name: net.name, chainId: net.chain, address: net.address, pinnedBlock: height,
      status, agree, expectedHashMatch, observations, providerErrors, preliminaryProviderAvailability: readings
    };
    result.deployments.push(report);
    console.log("DEPLOYMENT_SOURCE_MATCH " + JSON.stringify(report));
  }

  const outDir = path.resolve(__dirname, "results");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "bytecode-compare.json"), JSON.stringify(result, null, 2) + "\n");
  // Distinguish an independently reproduced EVM program from an exact
  // metadata/source provenance match for downstream audits.
  console.log("AUDIT_SCOPE executable runtime equality excludes compiler CBOR metadata; full source-file identity is NOT established");

  console.log("COMPILED_RUNTIME " + JSON.stringify(result.compiled));
  console.log("COMPILER_SETTINGS " + JSON.stringify(result.compiler));
  console.log("SOURCE_MATCH_SUMMARY " + JSON.stringify({
    comparisons: result.deployments.map(d => ({ chainId: d.chainId, status: d.status, agree: d.agree })),
    executableMatchAll: good,
    fullByteForByteAll: result.deployments.every(d => d.status === "FULL_BYTE_FOR_BYTE_MATCH")
  }));
  if (!good) process.exitCode = 1; // never claim verification when code differs.
})().catch(e => {
  console.error("AUDIT_FATAL " + String(e?.stack || e));
  process.exitCode = 1;
});
