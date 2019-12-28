<p align="center"> <img src="https://github.com/galtproject/galtproject-docs/blob/master/images/logo-black-1.png" alt="logo-black-360" width="200"/></p>


<h3 align="center">Galt Project Core Contracts (@galtproject/core)</h3>
<div align="center">
</div>

<div align="center">
<a href="https://gitlab.com/galtproject/galtproject-core/pipelines" target="_blank"><img src="https://gitlab.com/galtproject/galtproject-core/badges/develop/pipeline.svg" /></a>
<img src="https://img.shields.io/github/issues-raw/galtproject/galtproject-core.svg?color=green&style=flat-square" alt="Opened issues"/>
<img src="https://img.shields.io/github/issues-closed-raw/galtproject/galtproject-core.svg?color=blue&style=flat-square" alt="Closed issues" />
<img src="https://img.shields.io/github/issues-pr-closed/galtproject/galtproject-core.svg?color=green&style=flat-square" alt="Closed PR"/>
<img src="https://img.shields.io/github/issues-pr-raw/galtproject/galtproject-core.svg?color=green&style=flat-square" alt="Opened PR"/>
<img src="https://img.shields.io/badge/version-0.12.0-yellow.svg" alt="Contracts Version"/>
</div>
<br/>
<br/>
<div align="center">
  <img src="https://img.shields.io/github/contributors/galtproject/galtproject-core?style=flat-square" alt="Сontributors" />
  <img src="https://img.shields.io/badge/contributions-welcome-orange.svg?style=flat-square" alt="Contributions Welcome" />
  <a href="https://t.me/galtproject"><img src="https://img.shields.io/badge/Join%20Us%20On-Telegram-2599D2.svg?style=flat-square" alt="Join Us On Telegram" /></a>
  <a href="https://twitter.com/galtproject"><img src="https://img.shields.io/twitter/follow/galtproject?label=Follow&style=social" alt="Follow us on Twitter" /></a>
</div>
<br/>

Galt Project is an international decentralized land and real estate property registry governed by DAO (Decentralized autonomous organization) and self-governance protocol for communities of homeowners built on top of Ethereum blockchain. Unlike the state property registries, the Galt Project is managed by a decentralized community of property owners using smart contracts. Creation of property records, resolution of disputes between owners, trading, mortgage, title insurance, and many other operations are performed on smart contracts. Also, property owners can unite in communities for voting, fundraising, and managing the common property.

:page_with_curl: **For more information read the [Whitepaper](https://github.com/galtproject/galtproject-docs/blob/master/en/Whitepaper.md)**

:construction: **Project stage: Testnet**

At the moment, core contracts are completed and deployed in our private Testnet(RPC: https://https-rpc.testnet-58.galtproject.io/, Explorer: https://explorer.testnet-58.galtproject.io/), we are preparing a deployment of the first version of contracts on the mainnet.

:bomb: **Security review status: Unaudited**

Unfortunately, we do not currently have sufficient resources for a full audit of the created contracts. 

Our team believes that the Galt Project will enable people to transact land and real estate without borders and third parties. As well as creating self-governing communities without corruption and with transparent governance processes. 
You can contribute to this by checking the code and creating an issue, or by making a small donation to the address of the team **0x98064493535B22F6EbDf475341F0A6DaaBb7b538**.

Also you can use our Private property registry sollution now on mainnet with a small smart contract commissions.

:memo:**Get started contributing with a good first [issue](https://github.com/galtproject/galtproject-core/issues)**.

# Overview
This repository @galtproject/core contains main project contracts:
- **SpaceToken.sol** - ERC721 Token&. Each Token contains geospatial data and represents a particular land plot, whole building, room, or several rooms. We employ World Geodetic System (WGS84) as a primary Geodetic datum.
- **Governance Contracts (GlobalGovernance.sol,ACL.sol,ApplicationRegistry.sol,FeeRegistry.sol,GaltGlobalRegistry.sol,SpaceGeoDataRegistry.sol and others)** - contracts used for decentralized protocol governance (setting access rights for call contracts, defining contract parameters, etc.).
- **Applications** - Contracts used for interaction between protocol participants. For example, the Property Owner through one of the contracts can apply for the creation / change of the token, and the Cadastral engineer can approve its creation / change.
- **Factories** - Contract factories used by users.
- **PGG or Protocol Governance Group** - Contracts uniting real estate owners and Oracles (Cadastral engineers and Notaries) geographically into a group to create tokens and select Arbitrators to resolve disputes.
- **Reputation** - All protocol participants have a reputation by which they manage contracts. These contracts are used for reputation accounting.

## For Developers

* Compile contracts

```sh
make compile
```

* Run tests

```sh
make test
```

* Run Solidity and JavaScript linters

```sh
make validate
```
