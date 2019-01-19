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

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "../collections/ArraySet.sol";
import "../traits/Permissionable.sol";
import "./FundMultiSig.sol";
import "./FundStorage.sol";

contract FundController is Permissionable {
  using ArraySet for ArraySet.AddressSet;

  ERC20 galtToken;
  FundMultiSig multiSig;
  FundStorage fundStorage;

  constructor (
    ERC20 _galtToken,
    FundStorage _fundStorage,
    FundMultiSig _multiSig
  ) public {
    galtToken = _galtToken;
    fundStorage = _fundStorage;
    multiSig = _multiSig;
  }

  function payFine(uint256 _spaceTokenId, uint256 _amount) external {
    uint256 expectedPayment = fundStorage.getFineAmount(_spaceTokenId);

    require(expectedPayment > 0, "Fine amount is 0");
    require(expectedPayment >= _amount, "Amount for transfer exceeds fine value");

    galtToken.transferFrom(msg.sender, address(multiSig), _amount);
    fundStorage.decrementFine(_spaceTokenId, _amount);
    // TODO: accept galt tokens
    // TODO: make change in fund FundStorage
  }
}
