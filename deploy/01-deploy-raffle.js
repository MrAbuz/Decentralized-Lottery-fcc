const { network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.utils.parseEther("30")

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (developmentChains.includes(network.name)) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address

        //1.creating a chainlink subscription programatically, 2.getting subscriptionid 3.funding it, and 4.adding it as a consumer (this last one in the end of the code)
        //(we'll make this from the website ui but he made it here programaticaly so we learn how to do it)
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription() //to create a chainlink subscription programatically
        const transactionReceipt = await transactionResponse.wait(1)

        subscriptionId = transactionReceipt.events[0].args.subId //IMPORTANT: This is how you access the arguments of an event emited through a transaction
        //you get its transactionReceipt and then you use events[] to say which event you targeting and then args.".." to say which argument you targeting.
        //[0] is the number of events emited by order in the transaction to know which event (this was the first) (not the index of the argument of the event that we want)
        //ex: if in the transaction it called another function of another contract that emited an event and in the end this one emited an event, if we wanted to reach the event
        //of our transaction it would be the 2nd event there, index 1. So [0] means its the 1st emit that is generated when you call the function
        //then .args.subId to access which argument you want to extract. "subId" because thats how they called the subscriptionId argument in the emit of createSubscription()

        //now funding it (usually on a real network we'd need the link token, here we can use eth)
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
        //adding as a consumer: in the end of the code on this 01-deploy-raffle.js we also addour contract as a consumer (after the contract was deployed scroll down and
        //check). something that patrick forgot but after going through foruns I understood that we also needed to add this contract address as a consumer after deploying,
        //if we are doing this in a programatic way.
        //this is basicaly the same as when (in the video doing manualy on the site) he adds the contract address to the subscription after deploying it, so the susbcription
        //knows that this contract will make vrf requests and is funded through that subscription.
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        //for the testnet/mainnet we're not gonna create/fund chainlink subscription programatically, so that we also get familiar with creating it from the website's UI
        //we'll mostly create/fund this subscription from the website's ui I think, but we learned to make it programatically anyway
        //this looks so much easier to just make it from the ui and then add a subscription id (but lets see how we'll do it in the rest of the repo), but its good
        //to learn both ways.
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    const entranceFee = networkConfig[chainId]["entranceFee"]
    const gasLane = networkConfig[chainId]["gasLane"]
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    const interval = networkConfig[chainId]["interval"]
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ]

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })
    log("Main Contract Deployed!")

    //as i've explained above, we need to also add our contract as a consumer (after deploying it), while seting up everything programatically for chainlink vrf.
    //makes sense to be after the contract is deployed because to add as a consumer we need to add the contract address that we'll be requesting with.
    if (chainId == 31337) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock") //adding this here aswell because we needed it as a global variable
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address) //added as a consumer
        log("Consumer added!")
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(raffle.address, args)
    }
    log("-------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]
