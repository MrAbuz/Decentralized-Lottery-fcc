const { ethers } = require("hardhat")

const networkConfig = {
    //remember: this was created by us to query different variables for each chain
    5: {
        name: "goerli",
        vrfCoordinatorV2: "0x2ca8e0c643bde4c2e08ab1fa0da3401adad7734d", // *
        entranceFee: ethers.utils.parseEther("0.01"),
        //we want to make the entrance fee different depending on the chain we're on; if we're on a more expensive chain we wanna make this higher than others
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: "0",
        callbackGasLimit: "500000", //this also does vary from network to network, so we'll add it here; "pretty high limit of 500 thousand gas"
        interval: "30", //the lottery restarts after 30s
    },
    31337: {
        name: "hardhat",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15", //we're using the same one even tho its irrelevant, just to fill, it doesnt matter
        //which gas lane we input since here it'll be on hardhat/localhost
        callbackGasLimit: "500000",
        interval: "30",
    },
}

const developmentChains = ["hardhat", "localhost"]

module.exports = {
    networkConfig,
    developmentChains,
}

// * e ** vieram de : https://docs.chain.link/docs/vrf/v2/subscription/supported-networks/
