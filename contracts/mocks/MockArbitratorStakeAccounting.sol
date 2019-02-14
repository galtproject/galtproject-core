pragma solidity 0.5.3;

import "../multisig/ArbitratorStakeAccounting.sol";
import "../multisig/ArbitrationConfig.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract MockArbitratorStakeAccounting is ArbitratorStakeAccounting {
  constructor(
    IERC20 _galtToken,
    ArbitrationConfig _arbitrationConfig,
    uint256 _periodLengthInSeconds
  ) public ArbitratorStakeAccounting(_galtToken, _arbitrationConfig, _periodLengthInSeconds) {

  }

  function setInitialTimestamp(uint256 _newInitialTimestamp) external {
    _initialTimestamp = _newInitialTimestamp;
  }
}
