//We're gonna be a bit verbose here in this unit tests. We're gonna make our coverage really really good here. Not perfect, but pretty verbose.
//Keep making hh test --grep "..." as we do each test so we know we're doing them well

const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config") //if we're inside two folders this is how we do it, interesting

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", async function () {
          //we keep adding the variables that we need as we do each it() in here, and call them in the beforeEach() below.
          //initially we just called both contracts and the deployer, and then kept adding and initializing as we gone through the tests
          let raffle, vrfCoordinatorV2Mock, raffleEntranceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture(["all"])
              raffle = await ethers.getContract("Raffle", deployer)
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", async function () {
              it("initializes the raffle correctly", async function () {
                  //ideally we make our tests have just 1 assert per "it", but sometimes we're gonna have a bunch because we're being a bit loose here
                  const raffleState = await raffle.getRaffleState()

                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
              //we could've written more tests for the rest of the variables on the constructor, "but let's just move on"
          })

          describe("enterRaffle", async function () {
              it("reverts when you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith(
                      "Raffle__NotEnoughETHEntered"
                  )
              })
              //now we should test the "if(s_raffleState != RaffleState.OPEN) revert" but we'll test it in a little bit as we test the rest of the funtionality

              it("records players when they enter", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emits event on enter", async function () {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  ) //this works like to.emit("contract name", "event name")
              })

              it("doesnt allow entrance when raffle is calculating", async function () {
                  //to make the enum turn from OPEN to CALCULATING we see that we need to interact with performUpkeep, but performUpkeep can only be called if upKeepNeeded is true
                  //from checkUpKeep(). So we need to make checkUpKeep() return true, and pretend to be the chainlink keeper network and keep calling checkUpKeep() waiting for it
                  //to be true, and when its true, we pretend to be the chainlink keepers and call performUpKeep() to put the contract in the state of CALCULATING. Then, we try to
                  //enter the raffle and confirm that it reverts if the contract is in the CALCULATING state.
                  //to make checkUpKeep() return true we need to pass the 4 if statements, where only the 30s time passing was a problem
                  //
                  //special testing methods: evm_increaseTime; evm_mine
                  //for this we'll need to suddenly increase the time and the blocks, using special testing methods called evm_increaseTime and evm_mine. (there's more)
                  //we need to "evm_increaseTime" (to increase the time by 30s),
                  //but we also need to "evm_mine" (increase blocks), otherwise the time stays the same since the state of the blockchain didnt actually change from
                  //the last block cuz it updates on new blocks.

                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) //to increase the time by 31s
                  await network.provider.send("evm_mine", []) //with an empty array because we just want to simply mine 1 extra block
                  //we pretend to be a chainlink keeper
                  await raffle.performUpkeep([]) // we passed [] in order to "pass an empty calldata" which is the type of the argument in the contract.
                  //now the contract should be in a calculating state (because when we call performUpkeep() it changes the enum state to CALCULATING)
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })
      })
