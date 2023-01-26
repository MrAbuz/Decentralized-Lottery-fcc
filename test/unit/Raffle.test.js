//We're gonna be a bit verbose here in this unit tests. We're gonna make our coverage really really good here. Not perfect, but pretty verbose.
//Keep making hh test --grep (or yarn hardhat test --grep "...") "..." as we do each test so we know we're doing them well
//I'm starting to understand how we can do really good tests by always being super explicit in each tests that each condition is asserted and that the other fails
//so we take x conclusion. From what I can understand now we're being pretty verbose here, but we could be a lot more explicit but would take way more lines, but would
//be easy. I can also be wrong, but i'm pretty sure. A lot of times we're assuming x to be true cuz its logic it should be true, but we could be asserting it to be true
//so that every conditional is explicitely true in the test. One example. As I do more and more I bet i'll understand really well how to do this tests perfectly.

//Patrick: Ideally, only 1 assert per "it" block
//                  check everything
//                  check the test coverage in the end to make sure its 100%

const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config") //if we're inside two folders this is how we do it, interesting

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
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

          describe("constructor", function () {
              it("initializes the raffle correctly", async function () {
                  //ideally we make our tests have just 1 assert per "it", but sometimes we're gonna have a bunch because we're being a bit loose here
                  const raffleState = await raffle.getRaffleState()

                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
              //we could've written more tests for the rest of the variables on the constructor, "but let's just move on"
          })

          describe("enterRaffle", function () {
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
                  ) //this works like to.emit("name of variable that we're pointing to the contract", "event name")                                                *************
              })

              it("doesnt allow entrance when raffle is calculating", async function () {
                  //to make the enum turn from OPEN to CALCULATING we see that we need to interact with performUpkeep, but performUpkeep can only be called if upKeepNeeded is true
                  //from checkUpKeep(). So we need to make checkUpKeep() return true, and pretend to be the chainlink keeper network and keep calling checkUpKeep() waiting for it
                  //to be true, and when its true, we pretend to be the chainlink keepers and call performUpKeep() to put the contract in the state of CALCULATING. Then, we try to
                  //enter the raffle and confirm that it reverts if the contract is in the CALCULATING state.
                  //to make checkUpKeep() return true we need to pass the 4 if statements, where only the 30s time passing was a problem
                  //
                  //special testing methods: evm_increaseTime; evm_mine (super nice to learn this)
                  //for this we'll need to suddenly increase the time and the blocks, using special testing methods called evm_increaseTime and evm_mine. (there's more)
                  //we need to "evm_increaseTime" (method to increase the time by 30s),
                  //but we also need to "evm_mine" method (to increase blocks),otherwise the time stays the same since the state of the blockchain didnt actually change from
                  //the last block cuz it updates on new blocks (super nice, makes super sense)

                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) //to increase the time by 31s
                  await network.provider.send("evm_mine", []) //with an empty array because we just want to simply mine 1 extra block
                  //we pretend to be a chainlink keeper
                  await raffle.performUpkeep([]) // we passed [] in order to "pass an empty calldata" which is the type of the argument in the contract.
                  //now the contract should be in a calculating state (because when we call performUpkeep() it changes the enum state to CALCULATING)
                  //we called this instead of the chainlink keeper (but its okay cuz its external, they dont care if someone calls as long as it respects the requires from checkUpkeep()
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
          })
          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async function () {
                  //so we'll make everything be true in the 2 requires in checkUpkeep, except having no players in the array and having no eth in the contract
                  //what's true is: the enum state is already OPEN, so we'll make sure time > 30s.
                  //this basicaly tests both the requires of no players in array and no eth in the contract at the same time
                  // [] is the way to send a blanket bytes object as a parameter in a function, when you don't want to send nothing and its bytes. Other way is "0x"
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]) //to increase the time by 31s to make one require be true
                  await network.provider.send("evm_mine", []) //to pass 1 block so that the time gets updated, if no times pass the state remains the same

                  //CALLSTATIC (super funny thing to learn)
                  //The thing is: checkUpkeep is a public function. Since its a public function and not a public view function, by calling it, it will trigger a transaction,
                  //instead of just reading from the blockchain and returning the view.
                  //But I dont wanna send a transaction, I wanna simulate sending a transaction and seeing what this upKeepNeeded would return.
                  //I can actually get that by using something called "callstatic". We can simulate calling this transaction and seeing what it would respond and returns.

                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) //read above
                  assert(!upkeepNeeded) //assert that upkeepNeeded is false
              })

              it("returns false if raffle isn't open", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await raffle.performUpkeep([]) //this makes the enum state turn into CALCULATING
                  const raffleState = await raffle.getRaffleState()
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(raffleState.toString(), "1") //because the options on the enums are in reality 0,1,2..first chosen is 0, then 1, then 2. OPEN=0; CALCULATING=1.
                  assert.equal(upkeepNeeded, false) //same as assert (!upkeepNeeded) as we did above
              })

              it("returns false if enough time hasn't passed", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) //here we take time from the 30s to make sure its <30s
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, false)
              })

              it("returns true if enough time has passed, has players, has eth and is open", async function () {
                  //basically every require is true, so upkeepNeeded needs to be true
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, true) //                                                                                                                ***********
              })
          })
          describe("performUpkeep", function () {
              //funny that he's testing either that it runs if checkUpkeep is true, but also that it fails if checkUpkeep is false
              it("can only run if checkUpkeep is true", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await raffle.performUpkeep([])
                  assert(tx) //if tx doesnt work/performUpkeep() errors out, this will fail. Looks like the way to expect it to work, rather than to be reverted. Nice! **********
              })

              it("reverts when checkUpkeep is false", async function () {
                  //this is one of the examples that patrick didnt add this next two lines but I added them, bcuz by doing so Im being be super specific that upkeepNeeded
                  //is false, even tho its logical that it is, but im proving. I guess this is what he means its missing for the tests to be perfect.
                  const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([]) //callstatic explained above, to get the return of the function without making a transaction, because its not view. We just want the return
                  assert.equal(upkeepNeeded, false)
                  await expect(raffle.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  ) //this error in my solidity returns some variables. We could be super ************
                  //specific and add the values of the variables that we expect it to revert with, using string interpolation. But we'll do it in a simple way like this.
              })

              it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await raffle.performUpkeep([])
                  const txReceipt = await txResponse.wait(1)
                  const raffleState = await raffle.getRaffleState()

                  const requestId = txReceipt.events[1].args.requestId
                  //IMPORTANT: This is how you access the arguments of an event emited through a transaction
                  //remember that we did exactly the same in 01-deploy-raffle.js when we got the requestId from the emit of createSubscription()
                  //[1] is the number of events emited by order to know which event it is, this was the second, thats why its index 1.
                  //This is not the index of the argument of the event that we want, its which event it is.
                  //while calling performUpkeep(), we call requestRandomWords() from vrfCoordinator that emits an event first, so we're reaching for the 2nd event, index 1.
                  //We're reaching for the actual event that we emit in performUpkeep().
                  //Then we use .args.requestId to specify that we want the argument from the emit that is called "requestId".

                  //Since when we call requestRandomWords() it returns requestId that we emit in our event (check sol file), we're doing like this:
                  //But since requestRandomWords() also emits an event itself, I guess we could also just look at events[0].args.requestId (which is index 0 because
                  //requestRandomWords()'s emit is called first when performUpkeep() is called as I explained above, and the argument is also called "requestId" in
                  //the event of requestRandomWords()), we get the requestId, and prove that it is > 0. But, as we explained in the solidity file, we redundantely created
                  //our event in our contract that emits requestId just like requestRandomWords()'s event do, so here we're using our emit to prove, but we could also just
                  //use their to prove with events[0].args.requestId. Our was redundantly created.
                  //At the same time we proved that we emited an event
                  //This is how we prove that a function was called? bcuz our function called a function of other contract and that function of other contract emited an event?

                  assert(requestId.toNumber() > 0) //                                                                                                               *************
                  assert(raffleState.toString() == "1") //don't yet know the difference between toNumber() or toString()
              })
          })

          describe("fulfillRandomWords", function () {
              //we're gonna run a beforeEach because we want that someone has entered the raffle before we run any tests here. makes a lot of sense. we'd have to repeat this
              //code every time
              beforeEach(async function () {
                  await raffle.enterRaffle({ value: raffleEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })
              it("can only be called after performUpkeep", async function () {
                  //here we're gonna revert on some requests that don't exist (requestId's that don't exist)
                  //the fulfillRandomWords() from VRFCoordinatorv2 contract (if we go and have a look) has a require that verifies if the requestId exists, and reverts if it
                  //doesnt. That fulfillRandomWords() (not the one on our contract that we're doing tests to), is the function called by the chainlink node, that will call
                  //another contract that does the vrf. So we're testing if it reverts if it receives a request that doesn't exist.
                  //The requestRandomWords() that we call in performUpkeep() retrieves a requestId and starts the chain of things, so we're basically testing if its possible
                  //for someone to bypass it directly calling fulfillRandomWords() from the VRFCoordinatorv2 contract.
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.address) //(requestId, address); we're trying this with a requestId = 0
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.address) //we're trying this with a requestId = 1
                  ).to.be.revertedWith("nonexistent request")

                  //would be really hard for us to test every single possible requestId, we're gonna see a way in the future to actually test for a ton of this variables
                  //with something called fuzz testing, but we get to that in the future
              })
              it("picks a winner, resets the lottery, and sends money", async function () {
                  //this test is gonna be a really MASSIVE TEST and we could split it up into different sections, but he figured this to be the best way to show this section.
                  //this is one of the most difficult sections of this course, this test alone
                  //this test will be almost the exact same as the staging test that we'll create after
                  //this is the test that puts everything together
                  //this is kind of a lot for a single it(), you'd probably wanna split those into their own pieces, but for this we're just gonna put them all into one.
                  //we're gonna learn a couple of new tricks here
                  //15:53:00
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 //since deployer = 0
                  const accounts = await ethers.getSigners()
                  for (
                      let i = startingAccountIndex;
                      i < startingAccountIndex + additionalEntrants;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i])
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee })
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp()

                  await new Promise(async (resolve, reject) => {
                      //I need to use a promise here because I can only verify those things after fulfillRandomWords()(that emits the event) was called by the chainlink vrf. **************
                      //no html-fund-me-fcc também usei um listener dentro de uma promise, mas usei provider.once. "We're gonna settle that 'once' syntax"
                      //there's a good explanation for promise and .once in the end of this promise.
                      raffle.once("WinnerPicked", async () => {
                          //WinnerPicked is the name of the event of fulfillRandomWords(). "Listen for this WinnerPicked event, then do this function"
                          //We add this listener first, then we add the functions that will trigger the listener to listen. Since this is all inside an await with promise, it will await for the
                          //listener to listen, because the await only ends when it finds the promise/rejection that is inside the listener.
                          //only when this event is fired we want to assert things, because that means fulfillRandomWords was called. We need to wait for chainlink vrf to call it,
                          //because we'll only want to assert things here when fulfillRandomWords() was called, but we dont know when it is called, we need to listen for it.
                          console.log("Found the event!")
                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              //                              console.log(recentWinner)        //we used this to find out that acc 1 is the winner, to continue the tests
                              //                              console.log(accounts[2].address)
                              //                              console.log(accounts[0].address)
                              //                              console.log(accounts[1].address)
                              //                              console.log(accounts[3].address)
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalance()

                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp) //                                                                                 ***************

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      raffleEntranceFee
                                          .mul(additionalEntrants)
                                          .add(raffleEntranceFee)
                                          .toString()
                                      //makes total sense, the ending balance of the winner is the starting balance + the money from the 3 entrants and his money back
                                  )
                              )

                              //better to add a try catch because if something fails it causes a lot of headache, and like this if something we call fails it rejects.
                          } catch (e) {
                              reject()
                          }
                          resolve()
                      })
                      //we wanna set up our listener (.once) before calling performUpkeep() etc because we want that when we do fire the methods that will fire the event, our
                      //listener is already activated and waiting for it.
                      //and we wanna call performUpkeep inside the promise because the promise has an await and anything after it would not be called until it resolves,
                      //and we wanna call it inside the promise but outside of raffle.once because what is inside raffle.once is only called when the event is triggered,
                      //and performUpKeep() needs to be called so that the event is triggered
                      //we added a section in our hardhat.config.js with mocha: timeout 200000 that means anything that takes >200secs to execute will make the test fail
                      //this block of code below is just us mocking the chainlink keepers and chainlink vrf. in the staging tests this will be the only part we wont have
                      const tx = await raffle.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await accounts[1].getBalance() //we know its acc 1 because of the console.log we did up there to visually see which address was the winner
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      )
                      //we're doing the job of chainlink vrf in this await right above because in hardhat chain/localhost there's no access to chainlink.
                      //this function that we call up here (fulfillRandomWords) from vrfCoordinator is a function normally called by the chainlink nodes where if the proper
                      //requestId is inserted (that we get when we call requestRandomWords in our performUpkeep()), it generates a random number and sends to our fullfillRandomWords.
                      //Since there's no chainlink nodes in hardhat/localhost we're the ones calling and inserting the right requestId here for this test.
                      //This is not very important, just some specifics around chainlink and testing on hardhat/localhost.

                      //After calling this fulfillRandomWords it will take a bit of time for our fulfillRandomWords to be called and filled with the randomwords, that's why we using
                      //an event listener, so that it only asserts all those after it hears the event of fulfillRandoWords, which means its time to assert all those stuff that is
                      //done in fulfillRandomWords.

                      //Resume of this promise and .once thing:
                      //I'm actually understanding this .once/promise pretty well, because in the cases where we want to wait for something to be triggered in order to do any action,
                      //as I understand so far we want to use .once with a promise because if it was without an await promise the code wouldnt stand waiting for it to listen to
                      //the .once, so the only way it stays is adding it inside an await that will wait for it to resolve.
                      //We could probably do "await raffle.once()" but like this we wouldnt be able to add the calls we do after like performUpkeep() and then wait for it to listen,
                      //only way is like this to include everything in a big await, that has a promise because without a promise it would "skip" the .once because it has no await and
                      //execute the awaits after and when those awaits were done it would end probably before the listener getting executed. So with an await promise we tell that it
                      //has either to await for that code but also that it should only end once it resolves/rejects, and not when it executes the last line of code.
                      //With a promise is perfect bcuz it makes it able to wait for the .once, add things after the .once that are the calls that .once will listen, and then let
                      //us tell when we decide that the await is over.
                  })
              })
          })
      })

// Different asserts/expects I used in tests so far:
// (Expect with "await" always so far)

// 1) Assert that the transaction works
// const tx = await raffle.performUpkeep([])
// assert(tx)
// (performUpkeep didnt return anything)

// 2) Expect that the transaction doesnt work
// await expect(raffle.performUpkeep([])).to.be.revertedWith("Raffle__UpkeepNotNeeded")
// we can be explicit with the variables it is reverted in the error. And doenst need the with probably

// 3) Expect that the transaction emits an event
// await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
//    raffle,
//    "RaffleEnter"
// ) How it works: This works like to.emit("pointer contract variable", "event name")
//

// 4)
// assert(!upkeepNeeded)
// upkeepNeeded is a bool returned

// 5)
// assert.equal(upkeepNeeded, true) //
//

// 6)
// assert(requestId.toNumber() > 0) //
//

// 7)
// assert(raffleState.toString() == "1")
//

// 8)
// assert(tokenURIzero.includes("ipfs://"))
//
