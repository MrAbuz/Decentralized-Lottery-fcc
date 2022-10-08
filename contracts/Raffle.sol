// Raffle:
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automated
// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol"; //yarn add --dev @chainlink/contracts

error Raffle__NotEnoughETHEntered();

contract Raffle is VRFConsumerBaseV2 {
    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    /* Events */
    //A good syntax to name events is to use the function name but reversed
    event RaffleEnter(address indexed player);

    constructor(address vrfCoordinatorV2, uint256 entranceFee) VRFConsumerBaseV2(vrfCoordinatorV2) {
        //above is how we call the constructor of a contract we inherited.
        //we took the address that will generate the random number as a parameter and inputed it in the 2nd constructor of the contract we inherited.
        i_entranceFee = entranceFee;
    }

    function enterRaffle() public payable {
        // to remember the advantage of this vs require: instead of storing a string, it stores an error code in our smart contract which is a lot more gas efficient
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        s_players.push(payable(msg.sender));

        // Events:
        // Emit an event when we update a dynamic array or mapping
        // Events are one type of Logs.
        // This 'events' and 'logs' live in this special data structure that isn't accessible to smart contracts (thats why its cheaper vs storage, that's the trade off).
        // Events allows you to "print" stuff to this 'logging structure' in a way that's more gas efficient than actually saving it into something like a storage variable.
        // This events get emited to a data storage outside of the smart contract.
        // We can still print some information that is important to us, without having to save it in a storage variable which would take a lot more gas.
        // When we want to know if some transfer function was used, or something else, we can just wait and listen for its event. Events can be used for lots of things.

        // In events, we can have up to 3 indexed parameters/topics. Indexed parameters/topics are parameters that are much easier to search for, and much easier to query
        // than non-indexed parameters. The non-indexed parameters are ABI encoded, harder to reach. If we have the abi they're easy to decode, if not its really hard.
        // This non-indexed parameters cost less gas to pump into the Logs. They are in the 'data' section inside the 'Logs' section of etherscan.
        // In cases where we have our contract verified in etherscan, etherscan knows what the abi is, and we can see them clicking in the 'dec(oded mode)'.
        // The indexed parameters/topics are unencrypted and open to see, but cost more gas and you can only have 3 of them.

        emit RaffleEnter(msg.sender);
    }

    function requestRandomWinner() external {
        //external to save some gas, makes sense bcuz this is only called by the chainlink keepers
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords)
        internal
        override
    //is this internal (and the contract inherited) so that no1 can call this function i.e. cheat the system? if it was external/public they could, so only way for no1
    //to be able to call is either to be internal with inherit or external with a require for a certain address. Just speculating, lets see.
    {

    }

    /* View / Pure Functions */
    function getEntranceFee() public view returns (uint256) {
        //this nice logic to make i_entranceFee private and then create a get function if users need to get the value
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }
}

// One nice thing Patrick said: right at the begining when we just had a bit of the enterRaffle function, 1 event, 2 variables, 2 get functions, he said that at this point
// he'd start already writing some tests and already writing some deploy scripts. The reason that we do this is because its good to test our functionality as we progress,
// and often times when he's writing smart contracts he's often flipping between the deploy scripts, the contracts and the tests to make sure everything is doing exactly
// what he wants them to do. For the purpose of this course, and to make it easier for us to follow, we're gonna keep writing our smart contract almost until its complete,
// and then move to the deploy scripts and the tests. But in the future when we're making them its good to deploy and test as we're writing the contracts.
