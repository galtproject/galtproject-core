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
