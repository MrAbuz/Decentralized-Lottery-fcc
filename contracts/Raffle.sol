// Raffle:
// Enter the lottery (paying some amount)
// Pick a random winner (verifiably random)
// Winner to be selected every X minutes -> completly automated
// Chainlink Oracle -> Randomness, Automated Execution (Chainlink Keepers)

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

//for Chainlink VRF
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol"; //yarn add --dev @chainlink/contracts
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

//for Chainlink Keepers (which is now named Chainlink Automation)
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

error Raffle__NotEnoughETHEntered();
error Raffle__TransferFailed();
error Raffle__NotOpen();
error Raffle__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Raffle is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type declarations */
    // types should be first thing in our smart contract, acording to the best practises. Enum is a type
    // when we are creating an enum we are secretely creating a uint256 where 0 = OPEN, 1 = CALCULATING. But like this is much more explicit.
    enum RaffleState {
        OPEN,
        CALCULATING
    }

    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator; //always immutable when we're only setting this one time and never change
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId; //uint64 is enough, doesnt actually need to be a uint256
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    address private s_recentWinner;
    RaffleState private s_raffleState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval; //always think, will I change this variable in the future or not?

    /* Events */
    //A good syntax to name events is to use the function name but reversed
    event RaffleEnter(address indexed player);
    event RequestedRaffleWinner(uint256 indexed requestId); //for now we're not following the naming convention bcuz we'll be changing the name of the functions later. Prob when I see this its already following the naming convention
    event WinnerPicked(address indexed winner); //we don't have a way to keep track of the list of previous winners, so we're just gonna emit an event so that there's always gonna be that easily queriably history of event winners (and this is the use of thegraph as I think of)

    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        //above is how we call the constructor of a contract we inherited.
        //we took the address that will generate the random number as a parameter and inputed it in the 2nd constructor of the contract we inherited.
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane;
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        s_raffleState = RaffleState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterRaffle() public payable {
        // to remember the advantage of this vs require: instead of storing a string, it stores an error code in our smart contract which is a lot more gas efficient
        if (msg.value < i_entranceFee) {
            revert Raffle__NotEnoughETHEntered();
        }
        if (s_raffleState != RaffleState.OPEN) {
            revert Raffle__NotOpen();
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
        // For example in a lottery when there's a winner every 1 min, we can emit the address of the winner every time someone wins the lottery, but it's probably not worth
        // to have an array on storage recording every address that wins and constantly updating it every 1 min because that would cost a lot of gas, so makes sense to make
        // an emit with the address as an indexed variable (easily queriable) so that with protocols like the graph we can query that info if we need it, since its info
        // that we don't need for the smart contract to work on its own, but good to record/have.
        // Remember all of this, all super important

        emit RaffleEnter(msg.sender);
    }

    /**
     * @dev This is the function that then Chainlink keeper nodes call.
     * they look for the `upkeepNeeded` to be true.
     * The following should be true in order to return true:
     * 1. Our time interval should have passed
     * 2. The lottery should have at least 1 player, and have some ETH
     * 3. Our subscription is funded with LINK.
     * 4. The lottery should be in an "open" state (While we are waiting for our random numbers to come, we are in this wierd limbo state where we are waiting for it, but
     * we shouldnt allow any new player to join. What we want to do is create some state variable (enum) telling us whether the lottery is open or not)
     */

    function checkUpkeep(
        bytes calldata /*checkData*/
    )
        public
        view
        override
        returns (
            bool upkeepNeeded,
            bytes memory /*performData*/
        )
    {
        //this bytes calldata allows us to specify really anything that we want when we call this checkUpkeep function. Having this checkdata be of type bytes means that we
        // can even specify this to call other functions. There's a lot of advanced things we can do by just having an imput parameter of type bytes.
        //For us we're gonna keep this simple and not gonna use this checkdata piece (so we /**/ commented it out). This is more advanced stuff.
        //We made this public since we're calling this function from our performUpkeep() to make sure upkeepNeeded = true, and its not just somebody calling performUpkeep().
        // otherwise it would be external.

        bool isOpen = (RaffleState.OPEN == s_raffleState);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = address(this).balance > 0;

        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        //external to save some gas, makes sense bcuz this is only called by the chainlink keepers
        //function that will be called by the chainlink keeper and will make the vrf request

        //since anyone can call this function, we wanna make sure this is only called when upkeepNeeded from checkUpkeep() is true. If it is, and someone is calling this,
        //they are making us a favor:
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Raffle__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_raffleState)
            ); //we're passing some variables so that who ever is getting this error knows why they are getting this error (some of the conditions of upkeepNeeded not true)
        }

        s_raffleState = RaffleState.CALCULATING;

        uint256 requestId = i_vrfCoordinator.requestRandomWords( //this requestRandomWords() returns an uint256 requestId, an unique id that defines who's requesting this and all this info
            i_gasLane, //keyHash. Maximum gas price we're willing to pay for a request in wei, like a ceiling to prevent paying a lot on a possible spike up in gas. In the bottom of the file I have the link to pick the hash we want.
            i_subscriptionId, //The subscription ID that this contract uses for funding requests.
            REQUEST_CONFIRMATIONS, //How many confirmations the Chainlink node should wait before responding. We're not gonna worry too much about this and we'll make it a constant variable.
            i_callbackGasLimit, //max gas used for them to call our fulfillRandomWords(), which means how much gas does our fulfillRandomWords cost to call, depending on how complex we make it. We'll just know when we code our fulfillRandomWords function and know its gas so we'll set it in the constructor.
            NUM_WORDS //how many random numbers that we want to get. we'll hard code it as a constant
        );
        emit RequestedRaffleWinner(requestId);
    }

    function fulfillRandomWords(
        uint256, /*requestId*/
        uint256[] memory randomWords //function that will receive the random numbers
    )
        internal
        override
    //chainlink node will always call a 'fulfillRandomWords()' function, with this name.
    //It is inherited then overriden because the vrfcoordinator needs to make sure he can call this exact function.
    // /*requestId*/ we doing it like this because we needed to have requestId there because its an overriden function and it must be called exactly like that and have those
    // 2 arguments, but we're not using the variable, so we just maintain the argument spot with uint256 but we dont identify it(otherwise its an unused variable)
    //is this internal (and the contract inherited) so that no1 can call this function i.e. cheat the system? if it was external/public they could, so only way for no1
    //to be able to call is either to be internal with inherit or external with a require for a certain address. Just speculating, lets see.

    //This function is internal to either be protecting against someone externally calling this function with a pre-determined random number. But also because when we
    //call the function of i_vrfCoordinator contract in our requestRandomWinner(), it calls back another function in our inherited contract (rawFullFillRandomWords()),
    //not this one directly, that has a require to make sure its sent from address vrfCoordinatorV2, and if it is, it internally calls this function. So someone had to call
    //rawFullFillRandomWords()) to get around the system bcuz its the external one, but it had a require for coordinator address that we inputed in our constructor, so they
    //wouldnt be able to. Since it then calls internaly this function, its okay for this to be internal, which is also good to make it even impossible for someone to hack the VRF.

    //we're gonna pick a random winner using something calling the modulo function: (the same thing i've learned before of the remainder, the modulo operation yields the
    //remainder r after the division of the operand a by the operand n): 5 % 2 = 1 (1 is the remainder); 202 % 10 = 2 (and we always get a number in this case between
    // 0 and 9 because if it was 10 it would be included, so its perfect for this case because 10 would be the length and 9 is then the max index)
    {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_raffleState = RaffleState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;

        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Raffle__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /* View / Pure Functions */
    function getEntranceFee() public view returns (uint256) {
        //this nice logic to make i_entranceFee private and then create a get function if users need to get the value
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }
}
//Chainlink VRF:
//We are following this example -> https://docs.chain.link/docs/vrf/v2/subscription/examples/get-a-random-number/
//Watch this video: https://www.youtube.com/watch?v=rdJ5d8j1RCg

//      -keyHash: https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/#configurations
//
//For the Chainlink VRF we need to inherit the VRFConsumerBaseV2 and have a fulfillRandomWords() function overridden from it to be called. Also we need to call
// i_vrfCoordinator.requestRandomWords to request those numbers (which will be inside performUpkeep in this case).

//Chainlink Keepers:
//We are following this example -> https://docs.chain.link/docs/chainlink-automation/compatible-contracts/
//Watch this video: https://www.youtube.com/watch?v=-Wkw5JVQGUo
// There's 2 parts to building a Chainlink keeper upkept:
//         1) Write a smart contract that is compatible by implementing two methods (checkUpkeep and performUpkeep)
//         2) Register that smart contract for upkeep with the Chainlink keeper network
//We're probably not gonna use the "checkData" that is in this video but I think I've understood the purpose, it's when you have more than one keeper for the same contract,
//and you wanna send some different data with each different call so you can know which keeper is calling. I'm pretty sure it's that but I might be wrong :P

//For Chainlink Keepers we need to inherit AutomationCompatibleInterface() and have either an checkUpkeep() and a performUpkeep() overriden from it.

//Would be nice to create our own accounts for managing the chainlink balance for the VRF and Keeper

// One nice thing Patrick said: right at the begining when we just had a bit of the enterRaffle function, 1 event, 2 variables, 2 get functions, he said that at this point
// he'd start already writing some tests and already writing some deploy scripts. The reason that we do this is because its good to test our functionality as we progress,
// and often times when he's writing smart contracts he's often flipping between the deploy scripts, the contracts and the tests to make sure everything is doing exactly
// what he wants them to do. For the purpose of this course, and to make it easier for us to follow, we're gonna keep writing our smart contract almost until its complete,
// and then move to the deploy scripts and the tests. But in the future when we're making them its good to deploy and test as we're writing the contracts.

//14:50:37
