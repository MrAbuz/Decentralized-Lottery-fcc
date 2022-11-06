const { ethers, network } = require("hardhat")
const fs = require("fs")

//patrick uses this script to make his life easier, an update frontend deploy script
//it makes it so that if we want to make some change in our backend code, that change is instantly reflected on the frontend
//so, after that contract (that was changed) gets deployed, we run a script that creates the constants folder for us on the frontend file
//we're gonna make our aplication network agnostic so that when we deploy contracts, no matter what chain, we update our contants folder

const FRONT_END_ADDRESSES_FILE =
    "../nextjs-smartcontract-lottery-fcc/constants/contractAddresses.json"
const FRONT_END_ABI_FILE = "../nextjs-smartcontract-lottery-fcc/constants/abi.json"
//we started the two constant files in the frontend with a "{}" so that "both are json compatible".

module.exports = async function () {
    //we created a .env variable to choose if we want to update the frontend or not
    if (process.env.UPDATE_FRONT_END) {
        console.log("Updating front end...")
        updateContractAddresses()
        updateAbi()
    }
}

async function updateAbi() {
    //because the abi is always the same regardless of the network
    //"raffle.interface.format(ethers.utils.FormatTypes.json)" is the ethers way for us to get the ABI. Nice
    //notice how I didnt have to stringify, probably that line of code already formats the abi into json
    const raffle = await ethers.getContract("Raffle")
    fs.writeFileSync(FRONT_END_ABI_FILE, raffle.interface.format(ethers.utils.FormatTypes.json))
}

async function updateContractAddresses() {
    const raffle = await ethers.getContract("Raffle")
    const chainId = network.config.chainId.toString()
    const currentAddresses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, "utf8"))
    //we started the two constant files in the frontend with a "{}" so that "both are json compatible".
    //need to read again my notes about this in the initial lessons I think when we encrypted the private key
    if (chainId in currentAddresses) {
        if (!currentAddresses[chainId].includes(raffle.address)) {
            //if its not already included
            currentAddresses[chainId].push(raffle.address) //first time using an array in javascript
        }
    }
    {
        currentAddresses[chainId] = [raffle.address] //"we'll just add a new array"
    }
    //now that we've updated the currentAddresses object, we'll write it back to the file
    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddresses))
}

module.exports.tags = ["all", "frontend"]
