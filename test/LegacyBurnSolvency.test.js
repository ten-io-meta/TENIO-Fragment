const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TENIOFragment - local redemption and solvency regression", function () {
  let admin, holder, outsider, fragment;

  async function netReceived(signer, send) {
    const before = await ethers.provider.getBalance(signer.address);
    const receipt = await (await send()).wait();
    expect(receipt.status).to.equal(1);
    const fee = receipt.fee ?? receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(signer.address);
    return after + fee - before; // actual ETH received, net of paid transaction gas
  }

  beforeEach(async function () {
    [admin, holder, outsider] = await ethers.getSigners();
    const TENIOFragment = await ethers.getContractFactory("TENIOFragment");
    fragment = await TENIOFragment.connect(admin).deploy();
    await fragment.waitForDeployment();
  });

  it("CONFIRMS: owner withdrawal leaves zero ETH; holder burn still succeeds and pays zero", async function () {
    await fragment.connect(holder).mintFragment("ipfs://local-test", {
      value: ethers.parseEther("0.12")
    });
    expect(await fragment.ownerOf(1)).to.equal(holder.address);
    expect(await ethers.provider.getBalance(await fragment.getAddress()))
      .to.equal(ethers.parseEther("0.12"));

    await fragment.connect(admin).withdraw();
    expect(await ethers.provider.getBalance(await fragment.getAddress())).to.equal(0n);

    const received = await netReceived(holder, () => fragment.connect(holder).burn(1));
    expect(received).to.equal(0n); // No refund, despite a successfully mined burn.
    await expect(fragment.ownerOf(1)).to.be.reverted;
    expect(await fragment.balanceOf(holder.address)).to.equal(0n);
  });

  it("PAYS: a funded burn returns exactly 0.10 ETH and leaves 0.02 ETH", async function () {
    await fragment.connect(holder).mintFragment("ipfs://local-test", {
      value: ethers.parseEther("0.12")
    });
    const received = await netReceived(holder, () => fragment.connect(holder).burn(1));
    expect(received).to.equal(ethers.parseEther("0.10"));
    expect(await ethers.provider.getBalance(await fragment.getAddress()))
      .to.equal(ethers.parseEther("0.02"));
    await expect(fragment.ownerOf(1)).to.be.reverted;
  });

  it("CONFIRMS: only contract admin can sweep its full ETH balance", async function () {
    await fragment.connect(holder).mintFragment("ipfs://local-test", {
      value: ethers.parseEther("0.12")
    });
    await expect(fragment.connect(outsider).withdraw()).to.be.reverted;
    expect(await ethers.provider.getBalance(await fragment.getAddress()))
      .to.equal(ethers.parseEther("0.12"));
  });

  it("CONFIRMS: a transfer changes who is allowed to burn, but not the collateral promise", async function () {
    await fragment.connect(holder).mintFragment("ipfs://local-test", {
      value: ethers.parseEther("0.12")
    });
    await fragment.connect(holder).transferFrom(holder.address, outsider.address, 1);
    await expect(fragment.connect(holder).burn(1)).to.be.reverted;
    const received = await netReceived(outsider, () => fragment.connect(outsider).burn(1));
    expect(received).to.equal(ethers.parseEther("0.10"));
    expect(await ethers.provider.getBalance(await fragment.getAddress()))
      .to.equal(ethers.parseEther("0.02"));
  });
});
