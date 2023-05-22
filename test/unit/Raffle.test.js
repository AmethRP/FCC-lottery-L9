const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")
const { assert, expect } = require("chai")

describe("Raffle Unit Tests", function () {
    if (!developmentChains.includes(network.name)) {
        console.log(`Skipping Raffle Unit Tests for network: ${network.name}`)
        return
    }

    let raffle, VRFCoordinatorV2Mock, raffleEntranceFee, deployer, interval
    const chainId = network.config.chainId

    beforeEach(async function () {
        deployer = (await getNamedAccounts()).deployer
        await deployments.fixture(["all"])
        raffle = await ethers.getContract("Raffle", deployer)
        VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
        raffleEntranceFee = await raffle.getEntranceFee()
        interval = await raffle.getInterval()
    })

    describe("constructor", function () {
        it("initialises the raffle correctly", async function () {
            const raffleState = await raffle.getRaffleState()
            const interval = await raffle.getInterval()
            assert.equal(raffleState.toString(), "0")
            assert.equal(interval.toString(), networkConfig[chainId]["interval"])
        })
    })

    describe("enterRaffle", async function () {
        it("reverts when you dont pay enough", async function () {
            await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETHEntered")
        })
        it("records players when they enter", async function () {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            const playerFromContract = await raffle.getPlayer(0)
            assert.equal(playerFromContract, deployer)
        })
        it("emits event on enter", async function () {
            await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                raffle,
                "RaffleEnter"
            )
        })
        it("doesnt allow entrance when raffle is calculating", async function () {
            await raffle.enterRaffle({ value: raffleEntranceFee })
            console.log("raffle entered")
            await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
            console.log("time passed")
            await network.provider.send("evm_mine", [])
            console.log("block mined")
            // we pretend to be a chainlink keeper
            await raffle.performUpkeep([])
            console.log("state changed to calculating")
            await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                "Raffle__NotOpen"
            )
        })
    })
})
