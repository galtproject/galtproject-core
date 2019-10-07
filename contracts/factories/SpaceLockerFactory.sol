/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "../registries/interfaces/ILockerRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../interfaces/ISpaceToken.sol";
import "../registries/interfaces/ISpaceGeoDataRegistry.sol";
import "./interfaces/ISpaceLockerFactory.sol";
import "../SpaceLocker.sol";


contract SpaceLockerFactory is ISpaceLockerFactory {
  event NewSpaceLocker(address indexed owner, address locker);
  event EthFeeWithdrawal(address indexed collector, uint256 amount);
  event GaltFeeWithdrawal(address indexed collector, uint256 amount);

  bytes32 public constant FEE_KEY = bytes32("SPACE_LOCKER_FACTORY");
  bytes32 public constant ROLE_FEE_COLLECTOR = bytes32("FEE_COLLECTOR");

  GaltGlobalRegistry internal ggr;

  modifier onlyFeeCollector() {
    require(
      ggr.getACL().hasRole(msg.sender, ROLE_FEE_COLLECTOR),
      "Only FEE_COLLECTOR role allowed"
    );
    _;
  }

  constructor (
    GaltGlobalRegistry _ggr
  ) public {
    ggr = _ggr;
  }

  function build() external payable returns (ISpaceLocker) {
    _acceptPayment();

    ISpaceLocker locker = new SpaceLocker(ggr, msg.sender);

    ILockerRegistry(ggr.getSpaceLockerRegistryAddress()).addLocker(address(locker));

    emit NewSpaceLocker(msg.sender, address(locker));

    return ISpaceLocker(locker);
  }

  function withdrawEthFees() external onlyFeeCollector {
    uint256 balance = address(this).balance;

    msg.sender.transfer(balance);

    emit EthFeeWithdrawal(msg.sender, balance);
  }

  function withdrawGaltFees() external onlyFeeCollector {
    IERC20 galtToken = ggr.getGaltToken();
    uint256 balance = galtToken.balanceOf(address(this));

    galtToken.transfer(msg.sender, balance);

    emit GaltFeeWithdrawal(msg.sender, balance);
  }

  // INTERNAL

  function _acceptPayment() internal {
    if (msg.value == 0) {
      uint256 fee = IFeeRegistry(ggr.getFeeRegistryAddress()).getGaltFeeOrRevert(FEE_KEY);
      ggr.getGaltToken().transferFrom(msg.sender, address(this), fee);
    } else {
      uint256 fee = IFeeRegistry(ggr.getFeeRegistryAddress()).getEthFeeOrRevert(FEE_KEY);
      require(msg.value == fee, "Fee and msg.value not equal");
    }
  }
}
