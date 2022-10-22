const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle, raffleEntranceFee, deployer

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              //we dont need to deploy any fixture in staging tests because we're gonna run our deploy script and our contract should already be deployed to get with the next line (ethers.getContract())
              raffle = await ethers.getContract("Raffle", deployer)
              raffleEntranceFee = await raffle.getEntranceFee()
          })
          //we're just gonna make one giant test in to test everything end to end, and we can add more tests later on ourselves if we want to
          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  //we shouldn't need to do anything besides enter the raffle, because the chainlink keepers and chainlink vrf are gonna be the ones to actually kick this off

                  //we want to setup the listener before we enter the raffle just in case the blockchain moves really fast, because now the keepers and vrf will work by themselves
                  //we could've done the same in unit tests but we were manually calling the functions replacing keepers/vrf so we knew that adding the listener there was 100%
                  //before fulfillrandomwords(), which is what we need (to only assert things after fulfillrandomwords/its event is fired)
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  const accounts = await ethers.getSigners()

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          //Setting up the listener. "WinnerPicked" is the name of the event on fulfillRandomWords()
                          console.log("WinnerPicked event fired!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              const raffleState = await raffle.getRaffleState()
                              const winnerEndingBalance = await accounts[0].getBalance() //we're only entering with our deployer, so its the winner for sure.
                              //"We cant use the deployer object to check the balance", so we use the accounts[0] and initiated ethers.getSigners() which is our deployer too
                              //Weird. This is tricky. Need to remember this
                              const endingTimeStamp = await raffle.getLatestTimeStamp()

                              await expect(raffle.getPlayer(0)).to.be.reverted //in unit tests we did the same but in another way: assert.equal(numPlayers.toString(), "0")
                              assert.equal(recentWinner.toString(), accounts[0].address)
                              assert.equal(raffleState, 0) //in the unit test we did (raffleState.toString, "0")
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee).toString()
                              )
                              assert(endingTimeStamp > startingTimeStamp)
                              resolve()
                          } catch (error) {
                              console.log(error)
                              reject(error) //is it really with (e)? in unit test we did reject()
                          }
                      })
                      //Then entering the raffle
                      await raffle.enterRaffle({ value: raffleEntranceFee })
                      const winnerStartingBalance = await accounts[0].getBalance() //super smart, right after enterRaffle so the fees dont mess with the calculations

                      //and this code WONT complete until our listener has finished listening!(because the resolve() is inside .once, and .once just triggers when it
                      //listens to the event, since we're inside this big await promise)
                      //again, we want to use the listener because we just want to do the asserts after fulfillRandomWords() was fired, and we don't know how long it
                      //takes for chainlink nodes to call it, so we set up a listener and once the event of fulfillRandomWords is triggered, then we do the asserts and
                      //end with the resolve().

                      // In order for us to test our staging test, we first gonna need to do this things (16:18:30):
                      // 1. Get our SubId for Chainlink VRF
                      //            https://vrf.chain.link/
                      // 1.1 Fund it with Link
                      // 2. Deploy our contract using the SubId
                      // 3. Register the contract with Chainlink VRF @ it's subId
                      // 4. Register the contract with Chainlink Keepers
                      // 5. Run staging tests

                      //16:32:36
                  })
              })
          })
      })
