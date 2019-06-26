## Galt Project Contracts [v0.10.0](https://github.com/galtspace/galtproject-contracts/tree/v0.10.0) (2019-06-26)

- Adjust linter config
- Extract SpaceGeoDataRegistry logic from SplitMerge
- Temporarily remove SplitMerge
- Bump Solidity version to v0.5.7
- Make math safe using SafeMath
- Remove non-storage uint8s
- Replace SpaceToken Permissionable roles with ACL-level roles
- Add ROLE_APPLICATION_UNLOCKER who has permission to unlock applications locked by oracles
- Fix New/Update*PropertyManager resubmission methods
- Unify namings in application contracts
- Improve Event coverage in contracts scheduled for mainnet release
- Make selected contracts proxy-compatible (initialized using initializer())
- Bump OpenZeppelin to v2.3.0

- Rename { multisig/arbitration } => PGG (ProtocolGovernanceGroup)
- Move Oracles to PGG level
- Replace all PGG proposal contracts with a single one
- Replace PGG Permissionable roles with PGG-level ACL

- Rename PlotManager => NewPropertyManager
- Rename PlotClarificationManager => UpdatePropertyManager
- Move PlotCustodian application and registry contracts to @market submodule

- Add ModifySpaceGeoDataManager contract
- Add StakeTracker contract
- Add Statements contract 
- Add GlobalGovernance contract

## Galt Project Contracts [v0.9.0](https://github.com/galtspace/galtproject-contracts/tree/v0.9.0) (2019-04-11)

* Introduce Global FeeRegistry
* Introduce ACL
* Implement withdrawal methods for factories

## Galt Project Contracts [v0.8.0](https://github.com/galtspace/galtproject-contracts/tree/v0.8.0) (2019-04-04)

* Rafactor and extract some part of logic into separate modules like @libs, @math, @geodesic, @fund-basic, etc.
* Introduce GaltGlobalRegistry
* Reputation accounting refactoring. Intorduce SpaceRA/GaltRA/FundRA
* Move all application configs into multisig key=>value storage
* Intorduce ApplicationRegistry
* Add Galt reputation infrastructure to Arbitration voting
* Refactor Arbitration voting into 3 input sources: DelegateSpace/DelegateGalt/OracleStake
* ProtocolFee now accumulates on an application contract and can be withdrawn within a single call

## Galt Project Contracts [v0.6.0](https://github.com/galtspace/galtproject-contracts/tree/v0.6.0) (2019-01-18)

The full list of included changes:

- Add multi-custodian support to PlotCustodianManager.
- Move spaceToken => [custodians] mapping to the separate SpaceCustodianRegistry contract
- Introduce Arbitrators-level contracts with registry and factories
- Introduce global-level SpaceReputationAccounting to provide information for Arbitrator votings
- Introduce SpaceLocker which locks your token and provides token area information to \*SRA contracts
- Introduce 2 abstract application types - 1) Verified by Arbitrators; 2) Verified by Oracles
- Oracles now can be added using NewOraclesApplication and updated using UpdateOracleApplication. All these applications are verifiable by arbitrators.
- PlotManager now mints Space token within the final approve transaction
- Migrate to OpenZeppelin 2.0
- Remove ZeppelinOS dependency
- Convert LatLon to UTM in LandUtils
- Calculate UTM area for single zone in PolygonUtils
- Move calling of libs calculations from SplitMerge and SpaceSplitOperation to new contract Geodesic
- Implement new GaltDex based on Bancor contracts
- Implement GaltGenesis with sending wraped ETH to GaltDex
- Improve SplitOperation upgradability by using factory in SplitMerge
- Implement calculations of sqrt, sin, cos, tan, atan, exp, log
- Implement SplitMergeSandbox for fast testing split and merge calculations from ui
- Move geohash5Precision and geohash5ToGeohashString functions to GeohashUtils from LandUtils
- Improve deployed info for support multi-network paradigm
- Reports section with BancorGaltDex contract for build .csv files based on operations info


## Galt Project Contracts [v0.5.0](https://github.com/galtspace/galtproject-contracts/tree/v0.5.0) (2018-12-21)

The full list of included changes:

- Use MartinezRueda instead of BentleyOttman, remove BentleyOttman
- Add abstract LinkedList contract
- Implement SpaceSplitOperation for split geohash contours by WeilerAtherton and MartinezRueda
- Add benchmark scripts for MartinezRueda and SpaceSplitOperation
- Rework SplitMerge split method for deploy SpaceSplitOperation and using it for split geohash contours
- Implement Trigonometry utils with sin calculation: of degree and radians
- Implement PolygonUtils.getArea for get area from LatLon polygons

## Galt Project Contracts [v0.4.0](https://github.com/galtspace/galtproject-contracts/tree/v0.4.0) (2018-11-18)

The full list of included changes:

- Add new Auditors, ClaimManager, ValidatorStakes, MultiSigWallet contracts
- Merge PlotManager application and submition methods into a single one
- Introduce 3 activity flags for Validator: validator exists, role assigned, role staked
- Add benchmark scripts for gas used analyses
- Add abstract RedBlackTree contract
- Implement two children of RedBlackTree contract: PointRedBlackTree and SegmentRedBlackTree
- Add BentleyOttman algorithm, that uses PointRedBlackTree and SegmentRedBlackTree
- Add WeilerAtherton algorithm that uses BentleyOttman


## Galt Project Contracts [v0.3.0](https://github.com/galtspace/galtproject-contracts/tree/v0.3.0) (2018-10-17)

The full list of included changes:

* SpaceToken. Remove geohash/package support. Contract is simplified to keep track of an only entity.
* PlotClarificationManager. Remove hardcoded `clarification_pusher` role. Now all roles of this contract are dynamic.
* PlotClarificationManager. Remove `VALUATION_REQUIRED`, `VALUATION`, `PAYMENT_REQUIRED`, `PACKED` statuses and associated methods.
* PlotClarificationManager. Now an application accepts `newContour` array to be verified by validators.
* SplitMerge. Split packs(currently unsafe): set contour for old pack and create another new pack.
* SplitMerge. Merge packs(currently unsafe): set contour for destination pack and burn source pack.
* Rename `packageTokenId` => `spaceTokenId` since there are no `package` term anymore.
* Add ArraySet collection.
* Add PlotEscrow open orders caching.
* PlotEscrow contract size optimizations.


## Galt Project Contracts [v0.2.0](https://github.com/galtspace/galtproject-contracts/tree/v0.2.0) (2018-10-12)

There was no release of v0.1.0, so here is a full list of the initial features:

* GaltToken (`GALT`) - ERC20 token used within Galt Project contracts
* SpaceToken (`SPACE`) - ERC721 token used for tracking plot ownership
* GaltDex - ETH <=> GALT exchange
* SpaceDex - SPACE <=> GALT exchange
* SplitMerge - system contract for `SPACE` token merge and split operations
* Validators - CRUD management for system-wide validators
* LandUtils - utils, tools, helpers, etc.

* Application contracts:
  * PlotManager - `SPACE` token mint applications
  * PlotClarificationManager - `SPACE` token amend applications
  * PlotValuation - `SPACE` token valuation applications
  * PlotCustodianManager - `SPACE` token custodian assignment applications
  * PlotEscrow - a quick way to sell an already registered `SPACE` token
