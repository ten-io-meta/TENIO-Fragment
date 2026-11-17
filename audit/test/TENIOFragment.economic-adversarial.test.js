const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TENIOFragment original contract: economic adversarial controls", function () {
  let nft, issuer, holder, secondHolder;
  const mintPrice = ethers.parseEther("0.12");
  const expectedRedemption = ethers.parseEther("0.10");

  beforeEach(async function () {
    [issuer, holder, secondHolder] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TENIOFragment");
    nft = await Factory.connect(issuer).deploy();
    await nft.waitForDeployment();
  });

  async function mint(signer, suffix = "1") {
    return await nft.connect(signer).mintFragment("ipfs://" + suffix, { value: mintPrice });
  }

  it("positive control: funded burn pays 0.10 ETH while destroying NFT", async function () {
    await mint(holder);
    const beforeContract = await ethers.provider.getBalance(await nft.getAddress());
    expect(beforeContract).to.equal(mintPrice);
    const beforeUser = await ethers.provider.getBalance(holder.address);
    const receipt = await (await nft.connect(holder).burn(1)).wait();
    const fee = receipt.gasUsed * receipt.gasPrice;
    const afterUser = await ethers.provider.getBalance(holder.address);
    expect(afterUser + fee - beforeUser).to.equal(expectedRedemption);
    expect(await ethers.provider.getBalance(await nft.getAddress()))
      .to.equal(mintPrice - expectedRedemption);
    await expect(nft.ownerOf(1)).to.be.reverted;
  });

  it("critical counterexample: owner drains the entire backing before user burns", async function () {
    await mint(holder);
    const vault = await nft.getAddress();
    expect(await ethers.provider.getBalance(vault)).to.equal(mintPrice);

    await expect(nft.connect(holder).withdraw()).to.be.reverted;
    await nft.connect(issuer).withdraw();
    expect(await ethers.provider.getBalance(vault)).to.equal(0n);
    expect(await nft.ownerOf(1)).to.equal(holder.address);

    const beforeHolder = await ethers.provider.getBalance(holder.address);
    const receipt = await (await nft.connect(holder).burn(1)).wait();
    const spent = receipt.gasUsed * receipt.gasPrice;
    const afterHolder = await ethers.provider.getBalance(holder.address);

    expect(afterHolder + spent - beforeHolder).to.equal(0n); // no ETH payout
    await expect(nft.ownerOf(1)).to.be.reverted; // NFT destroyed nevertheless
    expect(await ethers.provider.getBalance(vault)).to.equal(0n);
  });

  it("critical counterexample: multiple live NFT liabilities are not reserved", async function () {
    await mint(holder, "a");
    await mint(secondHolder, "b");
    const vault = await nft.getAddress();
    expect(await ethers.provider.getBalance(vault)).to.equal(mintPrice * 2n);
    // A single authorized withdraw can remove both owners' expected backing.
    await nft.connect(issuer).withdraw();
    expect(await ethers.provider.getBalance(vault)).to.equal(0n);
    expect(await nft.ownerOf(1)).to.equal(holder.address);
    expect(await nft.ownerOf(2)).to.equal(secondHolder.address);
    const first = await (await nft.connect(holder).burn(1)).wait();
    const second = await (await nft.connect(secondHolder).burn(2)).wait();
    expect(first.status).to.equal(1);
    expect(second.status).to.equal(1);
    await expect(nft.ownerOf(1)).to.be.reverted;
    await expect(nft.ownerOf(2)).to.be.reverted;
  });

  it("critical counterexample: underfunded partial balance also permits silent burn", async function () {
    await mint(holder);
    const vault = await nft.getAddress();
    await nft.connect(issuer).withdraw();
    // Refunding *less* than the promised redemption cannot restore the guarantee.
    await issuer.sendTransaction({ to: vault, value: ethers.parseEther("0.05") });
    expect(await ethers.provider.getBalance(vault)).to.equal(ethers.parseEther("0.05"));
    await nft.connect(holder).burn(1);
    await expect(nft.ownerOf(1)).to.be.reverted;
    expect(await ethers.provider.getBalance(vault)).to.equal(ethers.parseEther("0.05"));
  });

  it("interface scope: ERC721 support does not imply IERC721Value or valueOf()", async function () {
    const strict = "0x88495fe7";
    const legacy = "0xcadf338f";
    expect(await nft.supportsInterface("0x01ffc9a7")).to.equal(true);
    expect(await nft.supportsInterface("0x80ac58cd")).to.equal(true);
    expect(await nft.supportsInterface(strict)).to.equal(false);
    expect(await nft.supportsInterface(legacy)).to.equal(false);
    expect(nft.interface.hasFunction("valueOf(uint256)")).to.equal(false);
    expect(nft.interface.hasFunction("burn(uint256)")).to.equal(true);
  });
});
