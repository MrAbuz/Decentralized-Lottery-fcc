# Decentralized Lottery using Chainlink VRF and Chainlink Keepers (Patrick Collins course)

-Dependencies

```

```

-Add .env -> specify the variables to add on .env

```

```

-Run the Unit tests

```
yarn hardhat test
```

-Now you need to setup the Chainlink VRF and Chainlink Keepers (before deploying, interacting with the contract or running the Staging tests):
(16:18:30)

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

-Deploy on testnet (if you've done already on the step before just skip)

```
yarn hardhat deploy --network goerli
```

-Run the Staging tests

```
yarn hardhat test --network goerli
```
