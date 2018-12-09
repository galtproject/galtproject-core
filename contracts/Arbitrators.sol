/*
 * Copyright ©️ 2018 Galt•Space Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka),
 * [Dima Starodubcev](https://github.com/xhipster),
 * [Valery Litvin](https://github.com/litvintech) by
 * [Basic Agreement](http://cyb.ai/QmSAWEG5u5aSsUyMNYuX2A2Eaz4kEuoYWUkVBRdmu9qmct:ipfs)).
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) and
 * Galt•Space Society Construction and Terraforming Company by
 * [Basic Agreement](http://cyb.ai/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS:ipfs)).
 */

pragma solidity 0.4.24;
pragma experimental "v0.5.0";

import "./collections/ArraySet.sol";
import "./multisig/ArbitratorsMultiSig.sol";
import "./traits/Permissionable.sol";

contract Arbitrators is Permissionable {
  using ArraySet for ArraySet.AddressSet;

  string public constant ROLE_ARBITRATOR_MANAGER = "arbitrator_manager";

  ArraySet.AddressSet arbitrators;
  mapping(address => uint256) public arbitratorWeight;

  uint256 public n;
  uint256 public m;

  ArbitratorsMultiSig arbitratorsMultiSig;

  constructor(
    ArbitratorsMultiSig _arbitratorsMultiSig
  )
    public
  {
    arbitratorsMultiSig = _arbitratorsMultiSig;
  }

  function addArbitrator(
    address _arbitrator,
    uint256 _weight
  )
    external
    onlyRole(ROLE_ARBITRATOR_MANAGER)
  {
    arbitrators.add(_arbitrator);
    arbitratorWeight[_arbitrator] = _weight;
  }

  function removeArbitrator(
    address _arbitrator
  )
    external
    onlyRole(ROLE_ARBITRATOR_MANAGER)
  {
    arbitrators.remove(_arbitrator);
    arbitratorWeight[_arbitrator] = 0;
  }

  function setArbitratorWeight(
    address _arbitrator,
    uint256 _weight
  )
    external
    onlyRole(ROLE_ARBITRATOR_MANAGER)
  {
    require(arbitrators.has(_arbitrator), "Arbitrator doesn't exist");

    arbitratorWeight[_arbitrator] = _weight;
  }

  function setMofN(
    uint256 _m,
    uint256 _n
  )
    external
    onlyRole(ROLE_ARBITRATOR_MANAGER)
  {
    require(2 <= _m, "Should satisfy `2 <= m`");
    require(_m <= _n, "Should satisfy `n <= n`");

    m = _m;
    n = _n;
  }

  function pushArbitrators(address[] descSortedArbitrators) external {
    require(descSortedArbitrators.length == arbitrators.size(), "Sorted arbitrators list should be equal to the stored one");

    uint256 len = descSortedArbitrators.length;
    uint256 previousWeight = arbitratorWeight[descSortedArbitrators[0]];
    require(previousWeight > 0, "Could not accept arbitrators with 0 weight");

    for (uint256 i = 0; i < len; i++) {
      uint256 currentWeight = arbitratorWeight[descSortedArbitrators[i]];
      require(currentWeight > 0, "Could not accept arbitrators with 0 weight");

      require(currentWeight <= previousWeight, "Invalid sorting");
      previousWeight = currentWeight;
    }

    arbitratorsMultiSig.setArbitrators(m, n, descSortedArbitrators);
  }

  // Getters
  function getArbitrators() public view returns (address[]) {
    return arbitrators.elements();
  }

  function getSize() public view returns (uint256 size) {
    return arbitrators.size();
  }
}
