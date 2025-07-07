const hre = require("hardhat");

async function main() {
  const TENIOFragment = await hre.ethers.getContractFactory("TENIOFragment");
  const contract = await TENIOFragment.deploy();

  await contract.deployed();

  console.log(`Contrato desplegado en: ${contract.address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
