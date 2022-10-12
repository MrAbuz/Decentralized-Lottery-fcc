const { developmentChains } = require("../helper-hardhat-config")
const { network } = require("hardhat")

const BASE_FEE = ethers.utils.parseEther("0.25")
//this means that for each request there's a base fee of 0.25 link (premium) (*)
//we normaly don't have to assign this because in normal chains this is a deployed contract where we obviously dont pass any arguments for constructor and we just call
// its functions, but here we do assign some variables cuz its a mock and those values are variable.
//the reason this costs 0.25 link per request and the price feeds didnt cost anything is because the price feeds are sponsored by a lot of protocols that are paying for those
//requests already, whereas here we are the only ones asking for this request.
//nice how we use parseEther even tho its 0.25 link and not eth.

const GAS_PRICE_LINK = 1e9 //we setted this to a price Patrick said, kind of random
//this number normaly fluctuates, but here we must assign a value cuz its a mock
//calculated value based on the gas price of the chain
//since the chainlink nodes are the ones making calls to our functions, they have to have a way to measure the gas of the chain so they don't go bankrupt.
//the more the price of gas goes up on the chain we using, the highest the price of the request we pay to the chainlink nodes

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const args = [BASE_FEE, GAS_PRICE_LINK]

    if (developmentChains.includes(network.name)) {
        log("Local network detected! Deploying mocks...")
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: args,
        })
        log("Mocks Deployed!")
        log("--------------------------")
    }
}

module.exports.tags = ["all", "mocks"]

// We have this "mocks" folder in the chainlink github with some mocks:
// https://github.com/smartcontractkit/chainlink/tree/develop/contracts/src/v0.8/mocks

// (*) We can find the premium, or FLAT FEE at:
// https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/
