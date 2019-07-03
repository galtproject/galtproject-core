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

pragma solidity 0.5.10;

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "./reputation/interfaces/IRA.sol";
import "./interfaces/IGaltLocker.sol";
import "./interfaces/ILocker.sol";
import "./registries/GaltGlobalRegistry.sol";


contract GaltLocker is ILocker, IGaltLocker {
  using SafeMath for uint256;
  using ArraySet for ArraySet.AddressSet;

  event ReputationMint(address indexed gra);
  event ReputationBurn(address indexed gra);
  event Deposit(uint256 amount);
  event Withdrawal(uint256 amount);
  event TransferExtra(address indexed to, uint256 amount);

  address public owner;
  uint256 public reputation;

  GaltGlobalRegistry private ggr;
  ArraySet.AddressSet private gras;

  constructor(GaltGlobalRegistry _ggr, address _owner) public {
    owner = _owner;
    ggr = _ggr;
  }

  modifier reputationAndBalanceEqual() {
    require(ggr.getGaltToken().balanceOf(address(this)) == reputation, "Reputation and balance are not equal");
    _;
  }

  modifier onlyOwner() {
    require(isOwner(), "Not the locker owner");
    _;
  }

  // deposit allowed only when there are no any gra in the minted list
  function deposit(uint256 _amount) external onlyOwner reputationAndBalanceEqual {
    require(gras.size() == 0, "GRAs counter not 0");

    reputation = reputation.add(_amount);
    ggr.getGaltToken().transferFrom(msg.sender, address(this), _amount);

    emit Deposit(_amount);
  }

  function withdraw(uint256 _amount) external onlyOwner reputationAndBalanceEqual {
    require(gras.size() == 0, "GRAs counter not 0");
    require(reputation >= _amount, "Reputation is less than withdrawal amount");

    reputation = reputation.sub(_amount);

    ggr.getGaltToken().transfer(msg.sender, _amount);

    emit Withdrawal(_amount);
  }

  // for cases when reputation and balance are not equal
  function transferExtraGalt(address _to) external onlyOwner {
    uint256 balance = ggr.getGaltToken().balanceOf(msg.sender);
    uint256 diff = balance.sub(reputation);

    assert(balance >= reputation);
    require(diff > 0, "Diff is 0");

    ggr.getGaltToken().transfer(_to, diff);

    emit TransferExtra(_to, diff);
  }

  function approveMint(IRA _gra) external onlyOwner reputationAndBalanceEqual {
    require(!gras.has(address(_gra)), "Already minted to this GRA");
    require(_gra.ping() == bytes32("pong"), "Handshake failed");

    gras.add(address(_gra));

    emit ReputationMint(address(_gra));
  }

  function burn(IRA _gra) external onlyOwner reputationAndBalanceEqual {
    require(gras.has(address(_gra)), "Not minted to the SRA");
    require(_gra.balanceOf(msg.sender) == 0, "Reputation not completely burned");

    gras.remove(address(_gra));

    emit ReputationBurn(address(_gra));
  }

  // GETTERS

  function isMinted(address _gra) external returns (bool) {
    return gras.has(_gra);
  }

  function getGras() external returns (address[] memory) {
    return gras.elements();
  }

  function getGrasCount() external returns (uint256) {
    return gras.size();
  }

  function isOwner() public view returns (bool) {
    return msg.sender == owner;
  }
}
