# Decentralized Lottery using Chainlink VRF and Chainlink Keepers

This repo provides the code for a Decentralized Lottery that is autonomous and verifiably random, created by Patrick Collins.

The next repo i'll add in this github will be the code for a front-end that connects to this lottery.

# -Quickstart

```
git clone https://github.com/MrAbuz/hardhat-smartcontract-lottery-fcc
cd hardhat-smartcontract-lottery-fcc
yarn
```

# -Install dependencies

```
yarn add --dev @nomiclabs/hardhat-ethers@npm:hardhat-deploy-ethers ethers @nomiclabs/hardhat-etherscan @nomiclabs/hardhat-waffle chai ethereum-waffle hardhat hardhat-contract-sizer hardhat-deploy hardhat-gas-reporter prettier prettier-plugin-solidity solhint solidity-coverage dotenv
```

# -Add a .env file (adding an goerli rpc url, a private key and an etherscan api key to the following variables):

```
GOERLI_RPC_URL=
PRIVATE_KEY=
ETHERSCAN_API_KEY=
```

# -Run the Unit tests

```
yarn hardhat test
```

# -Setup the Chainlink VRF and Chainlink Keepers (before deploying, interacting with the contract or running the Staging tests) in 4 steps:

(16:18:30) in the video

```
1. Get our SubId for Chainlink VRF
    https://vrf.chain.link/
    Connect wallet -> Create a subscription -> Fund the subscription with Goerli Link (https://faucets.chain.link/) -> Copy the ID you get when you create the subscription (ex: 5122) -> Go to our file "helper-hardhat-config.js" and paste that ID in the networkConfig object after "subscriptionId:".

2. Deploy our contract with the updated SubId
    yarn hardhat deploy --network goerli

3. Register the contract with Chainlink VRF @ it's subId
    Copy the deployed contract address that we deployed
    In the same page (https://vrf.chain.link/), click "add consumer"
    Paste the contract address in "Consumer address"

4. Register the contract with Chainlink Keepers
    https://automation.chain.link/
    -> "Register new Upkeep"
    -> Select: time-based trigger
    -> Target function: performUpkeep
    -> Function inputs: 0x
    -> Specify your time schedule (every 1min, lowest I could get): */1 * * * *
    -> Upkeep name: Raffle Upkeep
    -> Admin address, is automatically added, but its the address of the account you using to sign
    -> Gas limit: 500000
    -> Starting balance: 26
    -> Press "Register Upkeep"

```

# -By now you've already deployed the contract on Goerli, but if not:

```
yarn hardhat deploy --network goerli
```

# -Run the Staging test

```
yarn hardhat test --network goerli
```

# Have fun! :D
