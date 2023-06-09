import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

import {
  RSCValve,
  RSCValveFactory,
  RSCValveFactory__factory,
  TestToken,
  TestToken__factory,
  MockReceiver,
  MockReceiver__factory,
} from "../typechain-types";
import { snapshot, roles } from "./utils";

describe("RSCValve", function () {
  let rscValveFactory: RSCValveFactory,
    rscValve: RSCValve,
    testToken: TestToken,
    mockReceiver: MockReceiver,
    owner: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    addr3: SignerWithAddress,
    addr4: SignerWithAddress,
    addr5: SignerWithAddress,
    snapId: string;

  async function deployRSCValve(
    controller: any,
    distributors: any,
    isImmutableRecipients: any,
    isAutoNativeCurrencyDistribution: any,
    minAutoDistributeAmount: any,
    recipients: any,
    creationId: any
  ) {
    const tx = await rscValveFactory.createRSCValve({
      controller,
      distributors,
      isImmutableRecipients,
      isAutoNativeCurrencyDistribution,
      minAutoDistributeAmount,
      recipients,
      creationId,
    });
    const receipt = await tx.wait();
    const revenueShareContractAddress = receipt.events?.[13].args?.[0];
    const RevenueShareContract = await ethers.getContractFactory("RSCValve");
    const RSCValve = await RevenueShareContract.attach(
      revenueShareContractAddress
    );
    return RSCValve;
  }

  before(async () => {
    [owner, alice, bob, addr3, addr4, addr5] = await ethers.getSigners();
    rscValveFactory = await new RSCValveFactory__factory(owner).deploy();
    rscValve = await deployRSCValve(
      owner.address,
      [owner.address],
      false,
      true,
      ethers.utils.parseEther("1"),
      [{ addrs: alice.address, percentage: 10000000 }],
      ethers.constants.HashZero
    );
    testToken = await new TestToken__factory(owner).deploy();
    mockReceiver = await new MockReceiver__factory(owner).deploy();
  });

  beforeEach(async () => {
    snapId = await snapshot.take();
  });

  afterEach(async () => {
    await snapshot.restore(snapId);
  });

  it("Should set base attrs correctly", async () => {
    expect(await rscValve.hasRole(roles.admin, owner.address)).to.be.true;
    expect(await rscValve.hasRole(roles.distributor, owner.address)).to.be.true;

    expect(await rscValve.isAutoNativeCurrencyDistribution()).to.be.true;
    await rscValve.setAutoNativeCurrencyDistribution(false);
    expect(await rscValve.isAutoNativeCurrencyDistribution()).to.be.false;
    await expect(
      rscValve.connect(alice).setAutoNativeCurrencyDistribution(false)
    ).to.be.revertedWith(
      `AccessControl: account ${alice.address.toLowerCase()} is missing role ${
        roles.admin
      }`
    );

    expect(await rscValve.isImmutableRecipients()).to.be.false;
    await expect(
      rscValve.connect(alice).setImmutableRecipients()
    ).to.be.revertedWith(
      `AccessControl: account ${alice.address.toLowerCase()} is missing role ${
        roles.admin
      }`
    );
    await rscValve.setImmutableRecipients();
    expect(await rscValve.isImmutableRecipients()).to.be.true;
    await expect(
      rscValve.setImmutableRecipients()
    ).to.be.revertedWithCustomError(rscValve, "ImmutableRecipientsError");

    expect(await rscValve.minAutoDistributionAmount()).to.be.equal(
      ethers.utils.parseEther("1")
    );
    await rscValve.setMinAutoDistributionAmount(ethers.utils.parseEther("2"));
    expect(await rscValve.minAutoDistributionAmount()).to.be.equal(
      ethers.utils.parseEther("2")
    );

    await expect(
      rscValve
        .connect(alice)
        .setMinAutoDistributionAmount(ethers.utils.parseEther("2"))
    ).to.be.revertedWith(
      `AccessControl: account ${alice.address.toLowerCase()} is missing role ${
        roles.admin
      }`
    );
  });

  it("Should set recipients correctly", async () => {
    await expect(
      rscValve.connect(addr3).setRecipients([
        { addrs: alice.address, percentage: 2000000 },
        { addrs: addr3.address, percentage: 5000000 },
        { addrs: addr4.address, percentage: 3000000 },
      ])
    ).to.be.revertedWith(
      `AccessControl: account ${addr3.address.toLowerCase()} is missing role ${
        roles.controller
      }`
    );

    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 2000000 },
      { addrs: addr3.address, percentage: 5000000 },
      { addrs: addr4.address, percentage: 3000000 },
    ]);

    expect(await rscValve.recipients(0)).to.be.equal(alice.address);
    expect(await rscValve.recipients(1)).to.be.equal(addr3.address);
    expect(await rscValve.recipients(2)).to.be.equal(addr4.address);
    expect(await rscValve.recipientsPercentage(alice.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr3.address)).to.be.equal(
      5000000
    );
    expect(await rscValve.recipientsPercentage(addr4.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.numberOfRecipients()).to.be.equal(3);

    await expect(
      rscValve.setRecipients([
        { addrs: alice.address, percentage: 2000000 },
        { addrs: addr3.address, percentage: 5000000 },
        { addrs: addr4.address, percentage: 2000000 },
      ])
    ).to.be.revertedWithCustomError(rscValve, "InvalidPercentageError");

    expect(await rscValve.recipients(0)).to.be.equal(alice.address);
    expect(await rscValve.recipients(1)).to.be.equal(addr3.address);
    expect(await rscValve.recipients(2)).to.be.equal(addr4.address);
    expect(await rscValve.recipientsPercentage(alice.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr3.address)).to.be.equal(
      5000000
    );
    expect(await rscValve.recipientsPercentage(addr4.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.numberOfRecipients()).to.be.equal(3);

    await rscValve.setRecipients([
      { addrs: addr5.address, percentage: 2000000 },
      { addrs: addr4.address, percentage: 2000000 },
      { addrs: addr3.address, percentage: 3000000 },
      { addrs: alice.address, percentage: 3000000 },
    ]);

    expect(await rscValve.recipients(0)).to.be.equal(addr5.address);
    expect(await rscValve.recipients(1)).to.be.equal(addr4.address);
    expect(await rscValve.recipients(2)).to.be.equal(addr3.address);
    expect(await rscValve.recipients(3)).to.be.equal(alice.address);
    expect(await rscValve.recipientsPercentage(addr5.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr4.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr3.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.recipientsPercentage(alice.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.numberOfRecipients()).to.be.equal(4);

    await rscValve.grantRole(roles.controller, alice.address);
    await rscValve.grantRole(roles.distributor, alice.address);
    await rscValve.grantRole(roles.admin, alice.address);

    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 2000000 },
      { addrs: addr3.address, percentage: 5000000 },
      { addrs: addr4.address, percentage: 3000000 },
    ]);
  });

  it("NullAddressError()", async () => {
    await expect(
      rscValve.setRecipients([
        { addrs: alice.address, percentage: 5000000 },
        { addrs: ethers.constants.AddressZero, percentage: 5000000 },
      ])
    ).to.be.revertedWithCustomError(rscValve, "NullAddressError");

    await expect(
      rscValveFactory.createRSCValve({
        controller: owner.address,
        distributors: [ethers.constants.AddressZero],
        isImmutableRecipients: true,
        isAutoNativeCurrencyDistribution: false,
        minAutoDistributeAmount: ethers.utils.parseEther("1"),
        recipients: [
          { addrs: alice.address, percentage: 5000000 },
          { addrs: bob.address, percentage: 5000000 },
        ],
        creationId: ethers.constants.HashZero,
      })
    ).to.be.revertedWithCustomError(rscValve, "NullAddressError");

    await expect(
      rscValve.redistributeToken(ethers.constants.AddressZero)
    ).to.be.revertedWithCustomError(rscValve, "NullAddressError");
  });

  it("RecipientAlreadyAddedError()", async () => {
    await expect(
      rscValve.setRecipients([
        { addrs: alice.address, percentage: 5000000 },
        { addrs: alice.address, percentage: 5000000 },
      ])
    ).to.be.revertedWithCustomError(rscValve, "RecipientAlreadyAddedError");
  });

  it("TransferFailedError()", async () => {
    // With mock contract as recipient
    await rscValve.setAutoNativeCurrencyDistribution(false);
    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 5000000 },
      { addrs: mockReceiver.address, percentage: 5000000 },
    ]);
    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("50"),
    });
    await expect(
      rscValve.redistributeNativeCurrency()
    ).to.be.revertedWithCustomError(rscValve, "TransferFailedError");

    // With mock contract as platform wallet
    await rscValveFactory.setPlatformFee(2000000);
    await rscValveFactory.setPlatformWallet(mockReceiver.address);
    expect(await rscValveFactory.platformWallet()).to.be.equal(
      mockReceiver.address
    );
    const tx = await rscValveFactory.createRSCValve({
      controller: owner.address,
      distributors: [owner.address],
      isImmutableRecipients: true,
      isAutoNativeCurrencyDistribution: false,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      recipients: [
        { addrs: alice.address, percentage: 5000000 },
        { addrs: bob.address, percentage: 5000000 },
      ],
      creationId: ethers.constants.HashZero,
    });
    const receipt = await tx.wait();
    const revenueShareContractAddress = receipt.events?.[13].args?.[0];
    const RevenueShareContract = await ethers.getContractFactory("RSCValve");
    const rscValveFee = await RevenueShareContract.attach(
      revenueShareContractAddress
    );
    expect(await rscValveFee.platformFee()).to.be.equal(2000000);
    await owner.sendTransaction({
      to: rscValveFee.address,
      value: ethers.utils.parseEther("50"),
    });
    await expect(
      rscValveFee.redistributeNativeCurrency()
    ).to.be.revertedWithCustomError(rscValveFee, "TransferFailedError");
  });

  it("TooLowValueToRedistribute()", async () => {
    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 2000000 },
      { addrs: bob.address, percentage: 8000000 },
    ]);
    await expect(
      rscValve.setMinAutoDistributionAmount(1000000)
    ).to.be.revertedWithCustomError(rscValve, "TooLowValueToRedistribute");

    // With ether
    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBefore = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("0.000000000001"),
    });
    await expect(
      rscValve.redistributeNativeCurrency()
    ).to.be.revertedWithCustomError(rscValve, "TooLowValueToRedistribute");

    const aliceBalanceAfter = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfter = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();
    expect(aliceBalanceAfter).to.be.equal(aliceBalanceBefore);
    expect(bobBalanceAfter).to.be.equal(bobBalanceBefore);
  });

  it("Should set recipients correctly and set immutable recipients", async () => {
    await expect(
      rscValve.connect(addr3).setRecipientsExt([
        { addrs: alice.address, percentage: 2000000 },
        { addrs: addr3.address, percentage: 5000000 },
        { addrs: addr4.address, percentage: 3000000 },
      ])
    ).to.be.revertedWith(
      `AccessControl: account ${addr3.address.toLowerCase()} is missing role ${
        roles.controller
      }`
    );

    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 2000000 },
      { addrs: addr3.address, percentage: 5000000 },
      { addrs: addr4.address, percentage: 3000000 },
    ]);

    await expect(
      rscValve.setRecipientsExt([
        { addrs: alice.address, percentage: 2000000 },
        { addrs: addr3.address, percentage: 5000000 },
        { addrs: addr4.address, percentage: 2000000 },
      ])
    ).to.be.revertedWithCustomError(rscValve, "InvalidPercentageError");

    expect(await rscValve.recipients(0)).to.be.equal(alice.address);
    expect(await rscValve.recipients(1)).to.be.equal(addr3.address);
    expect(await rscValve.recipients(2)).to.be.equal(addr4.address);
    expect(await rscValve.recipientsPercentage(alice.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr3.address)).to.be.equal(
      5000000
    );
    expect(await rscValve.recipientsPercentage(addr4.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.numberOfRecipients()).to.be.equal(3);

    await rscValve.setRecipientsExt([
      { addrs: addr5.address, percentage: 2000000 },
      { addrs: addr4.address, percentage: 2000000 },
      { addrs: addr3.address, percentage: 3000000 },
      { addrs: alice.address, percentage: 3000000 },
    ]);

    expect(await rscValve.recipients(0)).to.be.equal(addr5.address);
    expect(await rscValve.recipients(1)).to.be.equal(addr4.address);
    expect(await rscValve.recipients(2)).to.be.equal(addr3.address);
    expect(await rscValve.recipients(3)).to.be.equal(alice.address);
    expect(await rscValve.recipientsPercentage(addr5.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr4.address)).to.be.equal(
      2000000
    );
    expect(await rscValve.recipientsPercentage(addr3.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.recipientsPercentage(alice.address)).to.be.equal(
      3000000
    );
    expect(await rscValve.numberOfRecipients()).to.be.equal(4);

    await expect(
      rscValve.setRecipientsExt([
        { addrs: alice.address, percentage: 2000000 },
        { addrs: addr3.address, percentage: 5000000 },
        { addrs: addr4.address, percentage: 3000000 },
      ])
    ).to.be.revertedWithCustomError(rscValve, "ImmutableRecipientsError");

    await expect(
      rscValve.setRecipients([
        { addrs: alice.address, percentage: 2000000 },
        { addrs: addr3.address, percentage: 5000000 },
        { addrs: addr4.address, percentage: 3000000 },
      ])
    ).to.be.revertedWithCustomError(rscValve, "ImmutableRecipientsError");
  });

  it("Should redistribute ETH correctly via receive()", async () => {
    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 8000000 },
      { addrs: bob.address, percentage: 2000000 },
    ]);

    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBefore = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("50"),
    });

    const aliceBalanceAfter = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfter = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    expect(aliceBalanceAfter).to.be.equal(
      aliceBalanceBefore + ethers.utils.parseEther("40").toBigInt()
    );
    expect(bobBalanceAfter).to.be.equal(
      bobBalanceBefore + ethers.utils.parseEther("10").toBigInt()
    );
  });

  it("Should redistribute ETH correctly", async () => {
    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 8000000 },
      { addrs: bob.address, percentage: 2000000 },
    ]);

    expect(await rscValve.numberOfRecipients()).to.be.equal(2);

    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBefore = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("50"),
    });

    const aliceBalanceAfter = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceAfter = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    expect(aliceBalanceAfter).to.be.equal(
      aliceBalanceBefore + ethers.utils.parseEther("40").toBigInt()
    );
    expect(bobBalanceAfter).to.be.equal(
      bobBalanceBefore + ethers.utils.parseEther("10").toBigInt()
    );

    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("0.5"),
    });

    expect(
      (await ethers.provider.getBalance(rscValve.address)).toBigInt()
    ).to.be.equal(ethers.utils.parseEther("0.5"));

    await rscValve.redistributeNativeCurrency();

    expect(
      (await ethers.provider.getBalance(rscValve.address)).toBigInt()
    ).to.be.equal(ethers.utils.parseEther("0"));

    expect(
      (await ethers.provider.getBalance(alice.address)).toBigInt()
    ).to.be.equal(
      aliceBalanceAfter + ethers.utils.parseEther("0.4").toBigInt()
    );
    expect(
      (await ethers.provider.getBalance(bob.address)).toBigInt()
    ).to.be.equal(bobBalanceAfter + ethers.utils.parseEther("0.1").toBigInt());
  });

  it("Should redistribute ERC20 token", async () => {
    await testToken.mint(rscValve.address, ethers.utils.parseEther("100"));

    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 2000000 },
      { addrs: bob.address, percentage: 8000000 },
    ]);

    await rscValve.redistributeToken(testToken.address);
    expect(await testToken.balanceOf(rscValve.address)).to.be.equal(0);
    expect(await testToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("20")
    );
    expect(await testToken.balanceOf(bob.address)).to.be.equal(
      ethers.utils.parseEther("80")
    );

    await testToken.mint(rscValve.address, ethers.utils.parseEther("100"));

    await expect(
      rscValve.connect(addr3).redistributeToken(testToken.address)
    ).to.be.revertedWith(
      `AccessControl: account ${addr3.address.toLowerCase()} is missing role ${
        roles.distributor
      }`
    );

    await expect(
      rscValve.connect(addr3).grantRole(roles.distributor, addr3.address)
    ).to.be.revertedWith(
      `AccessControl: account ${addr3.address.toLowerCase()} is missing role ${
        roles.admin
      }`
    );

    await rscValve.grantRole(roles.distributor, addr3.address);
    await rscValve.connect(addr3).redistributeToken(testToken.address);

    expect(await testToken.balanceOf(rscValve.address)).to.be.equal(0);
    expect(await testToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("40")
    );
    expect(await testToken.balanceOf(bob.address)).to.be.equal(
      ethers.utils.parseEther("160")
    );
  });

  it("Should initialize only once", async () => {
    await expect(
      rscValve.initialize(
        bob.address,
        ethers.constants.AddressZero,
        [owner.address],
        false,
        true,
        ethers.utils.parseEther("1"),
        BigInt(0),
        [{ addrs: alice.address, percentage: 10000000 }]
      )
    ).to.be.revertedWith("Initializable: contract is already initialized");
  });

  it("Should create manual distribution split", async () => {
    const RSCValveManualDistribution = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      false,
      ethers.utils.parseEther("1"),
      [
        { addrs: alice.address, percentage: 5000000 },
        { addrs: bob.address, percentage: 5000000 },
      ],
      ethers.constants.HashZero
    );

    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: RSCValveManualDistribution.address,
      value: ethers.utils.parseEther("50"),
    });

    const contractBalance = (
      await ethers.provider.getBalance(RSCValveManualDistribution.address)
    ).toBigInt();
    expect(contractBalance).to.be.equal(ethers.utils.parseEther("50"));

    await expect(
      RSCValveManualDistribution.connect(addr3).redistributeNativeCurrency()
    ).to.be.revertedWith(
      `AccessControl: account ${addr3.address.toLowerCase()} is missing role ${
        roles.distributor
      }`
    );

    await RSCValveManualDistribution.redistributeNativeCurrency();

    const contractBalance2 = (
      await ethers.provider.getBalance(RSCValveManualDistribution.address)
    ).toBigInt();
    expect(contractBalance2).to.be.equal(0);

    const aliceBalanceAfter = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    expect(aliceBalanceAfter).to.be.equal(
      aliceBalanceBefore + ethers.utils.parseEther("25").toBigInt()
    );
  });

  it("Should work with fees Correctly", async () => {
    await rscValveFactory.setPlatformWallet(addr5.address);
    await rscValveFactory.setPlatformFee(BigInt(5000000));

    expect(await rscValveFactory.platformWallet()).to.be.equal(addr5.address);
    expect(await rscValveFactory.platformFee()).to.be.equal(BigInt(5000000));

    const txFee = await rscValveFactory.createRSCValve({
      controller: owner.address,
      distributors: [owner.address],
      isImmutableRecipients: true,
      isAutoNativeCurrencyDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      recipients: [{ addrs: alice.address, percentage: BigInt(10000000) }],
      creationId: ethers.constants.HashZero,
    });
    const receipt = await txFee.wait();
    const revenueShareContractAddress = receipt.events?.[13].args?.[0];
    const RevenueShareContract = await ethers.getContractFactory("RSCValve");
    const rscFeeValve = await RevenueShareContract.attach(
      revenueShareContractAddress
    );

    const platformWalletBalanceBefore = (
      await ethers.provider.getBalance(addr5.address)
    ).toBigInt();
    const aliceBalanceBefore = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: rscFeeValve.address,
      value: ethers.utils.parseEther("50"),
    });

    const platformWalletBalanceAfter = (
      await ethers.provider.getBalance(addr5.address)
    ).toBigInt();
    const aliceBalanceAfter = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();

    expect(platformWalletBalanceAfter).to.be.equal(
      platformWalletBalanceBefore + ethers.utils.parseEther("25").toBigInt()
    );
    expect(aliceBalanceAfter).to.be.equal(
      aliceBalanceBefore + ethers.utils.parseEther("25").toBigInt()
    );

    await testToken.mint(rscFeeValve.address, ethers.utils.parseEther("100"));
    await rscFeeValve.redistributeToken(testToken.address);

    expect(await testToken.balanceOf(addr5.address)).to.be.equal(
      ethers.utils.parseEther("50")
    );
    expect(await testToken.balanceOf(alice.address)).to.be.equal(
      ethers.utils.parseEther("50")
    );
  });

  it("Should work with creation ID correctly", async () => {
    const RSCValveCreationIdFactory = await ethers.getContractFactory(
      "RSCValveFactory"
    );
    const rscValveCreationIdFactory = await RSCValveCreationIdFactory.deploy();
    await rscValveCreationIdFactory.deployed();

    await rscValveCreationIdFactory.createRSCValve({
      controller: owner.address,
      distributors: [owner.address],
      isImmutableRecipients: true,
      isAutoNativeCurrencyDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      recipients: [{ addrs: alice.address, percentage: BigInt(10000000) }],
      creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
    });

    await expect(
      rscValveCreationIdFactory.createRSCValve({
        controller: owner.address,
        distributors: [owner.address],
        isImmutableRecipients: true,
        isAutoNativeCurrencyDistribution: true,
        minAutoDistributeAmount: ethers.utils.parseEther("1"),
        recipients: [{ addrs: alice.address, percentage: BigInt(10000000) }],
        creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
      })
    ).to.be.revertedWith("ERC1167: create2 failed");

    await rscValveCreationIdFactory.createRSCValve({
      controller: owner.address,
      distributors: [owner.address],
      isImmutableRecipients: true,
      isAutoNativeCurrencyDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      recipients: [
        { addrs: alice.address, percentage: BigInt(5000000) },
        { addrs: bob.address, percentage: BigInt(5000000) },
      ],
      creationId: ethers.utils.formatBytes32String("test-creation-id-1"),
    });

    await rscValveCreationIdFactory.createRSCValve({
      controller: owner.address,
      distributors: [owner.address],
      isImmutableRecipients: true,
      isAutoNativeCurrencyDistribution: true,
      minAutoDistributeAmount: ethers.utils.parseEther("1"),
      recipients: [{ addrs: alice.address, percentage: BigInt(10000000) }],
      creationId: ethers.utils.formatBytes32String("test-creation-id-2"),
    });
  });

  it("Should recursively split ERC20", async () => {
    const rscValveThird = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      false,
      ethers.utils.parseEther("1"),
      [
        { addrs: alice.address, percentage: BigInt(5000000) },
        { addrs: bob.address, percentage: BigInt(5000000) },
      ],
      ethers.constants.HashZero
    );

    const rscValveSecond = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      false,
      ethers.utils.parseEther("1"),
      [
        { addrs: mockReceiver.address, percentage: BigInt(5000000) },
        { addrs: rscValveThird.address, percentage: BigInt(5000000) },
      ],
      ethers.constants.HashZero
    );

    const rscValveMain = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      false,
      ethers.utils.parseEther("1"),
      [{ addrs: rscValveSecond.address, percentage: BigInt(10000000) }],
      ethers.constants.HashZero
    );

    await testToken.mint(
      rscValveMain.address,
      ethers.utils.parseEther("1000000")
    );
    await testToken.mint(
      rscValveSecond.address,
      ethers.utils.parseEther("1000000")
    );
    await testToken.mint(
      rscValveThird.address,
      ethers.utils.parseEther("1000000")
    );

    await rscValveSecond.grantRole(roles.distributor, rscValveMain.address);
    await rscValveThird.grantRole(roles.distributor, rscValveSecond.address);
    await rscValveMain.redistributeToken(testToken.address);

    expect(await testToken.balanceOf(rscValveMain.address)).to.be.equal(0);
    expect(await testToken.balanceOf(rscValveSecond.address)).to.be.equal(0);
    expect(await testToken.balanceOf(rscValveThird.address)).to.be.equal(0);
  });

  it("Should recursively split ETH", async () => {
    const rscValveThird = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      false,
      ethers.utils.parseEther("1"),
      [
        { addrs: alice.address, percentage: BigInt(5000000) },
        { addrs: bob.address, percentage: BigInt(5000000) },
      ],
      ethers.constants.HashZero
    );

    const rscValveSecond = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      true,
      ethers.utils.parseEther("1"),
      [
        { addrs: alice.address, percentage: BigInt(5000000) },
        { addrs: rscValveThird.address, percentage: BigInt(5000000) },
      ],
      ethers.constants.HashZero
    );

    const rscValveMain = await deployRSCValve(
      owner.address,
      [owner.address],
      true,
      false,
      ethers.utils.parseEther("1"),
      [{ addrs: rscValveSecond.address, percentage: BigInt(10000000) }],
      ethers.constants.HashZero
    );

    await owner.sendTransaction({
      to: rscValveMain.address,
      value: ethers.utils.parseEther("50"),
    });

    await owner.sendTransaction({
      to: rscValveSecond.address,
      value: ethers.utils.parseEther("50"),
    });

    await owner.sendTransaction({
      to: rscValveThird.address,
      value: ethers.utils.parseEther("50"),
    });

    await rscValveSecond.grantRole(roles.distributor, rscValveMain.address);
    await rscValveThird.grantRole(roles.distributor, rscValveSecond.address);
    await rscValveMain.redistributeNativeCurrency();

    expect(await ethers.provider.getBalance(rscValveMain.address)).to.be.equal(
      0
    );
    expect(
      await ethers.provider.getBalance(rscValveSecond.address)
    ).to.be.equal(0);
    expect(await ethers.provider.getBalance(rscValveThird.address)).to.be.equal(
      0
    );
  });

  it("Should distribute small amounts correctly", async () => {
    await rscValve.setRecipients([
      { addrs: alice.address, percentage: BigInt(2000000) },
      { addrs: bob.address, percentage: BigInt(8000000) },
    ]);

    await testToken.mint(rscValve.address, BigInt(15000000));

    await rscValve.redistributeToken(testToken.address);
    expect(await testToken.balanceOf(alice.address)).to.be.equal(
      BigInt(3000000)
    );
    expect(await testToken.balanceOf(bob.address)).to.be.equal(
      BigInt(12000000)
    );
    expect(await testToken.balanceOf(rscValve.address)).to.be.equal(BigInt(0));

    await testToken.mint(rscValve.address, BigInt(15000000));

    await rscValve.redistributeToken(testToken.address);
    expect(await testToken.balanceOf(alice.address)).to.be.equal(
      BigInt(6000000)
    );
    expect(await testToken.balanceOf(bob.address)).to.be.equal(
      BigInt(24000000)
    );
    expect(await testToken.balanceOf(rscValve.address)).to.be.equal(BigInt(0));
  });

  it("Should distribute small ether amounts correctly", async () => {
    await rscValve.setMinAutoDistributionAmount(BigInt(10000000));
    await rscValve.setRecipients([
      { addrs: alice.address, percentage: 5000000 },
      { addrs: bob.address, percentage: 5000000 },
    ]);

    const aliceBalanceBefore1 = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBefore1 = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("0.000000000015"),
    });

    expect(
      (await ethers.provider.getBalance(alice.address)).toBigInt()
    ).to.be.equal(
      aliceBalanceBefore1 +
        ethers.utils.parseEther("0.0000000000075").toBigInt()
    );
    expect(
      (await ethers.provider.getBalance(bob.address)).toBigInt()
    ).to.be.equal(
      bobBalanceBefore1 + ethers.utils.parseEther("0.0000000000075").toBigInt()
    );
    expect(
      (await ethers.provider.getBalance(rscValve.address)).toBigInt()
    ).to.be.equal(BigInt(0));

    const aliceBalanceBefore2 = (
      await ethers.provider.getBalance(alice.address)
    ).toBigInt();
    const bobBalanceBefore2 = (
      await ethers.provider.getBalance(bob.address)
    ).toBigInt();

    await owner.sendTransaction({
      to: rscValve.address,
      value: ethers.utils.parseEther("0.000000000015"),
    });

    expect(
      (await ethers.provider.getBalance(rscValve.address)).toBigInt()
    ).to.be.equal(BigInt(0));
    expect(
      (await ethers.provider.getBalance(alice.address)).toBigInt()
    ).to.be.equal(
      aliceBalanceBefore2 +
        ethers.utils.parseEther("0.0000000000075").toBigInt()
    );

    expect(
      (await ethers.provider.getBalance(bob.address)).toBigInt()
    ).to.be.equal(
      bobBalanceBefore2 + ethers.utils.parseEther("0.0000000000075").toBigInt()
    );
  });
});
