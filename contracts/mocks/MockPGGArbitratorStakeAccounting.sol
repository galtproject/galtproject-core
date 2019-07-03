pragma solidity 0.5.10;

import "../pgg/PGGArbitratorStakeAccounting.sol";
import "../pgg/PGGConfig.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";


contract MockPGGArbitratorStakeAccounting is PGGArbitratorStakeAccounting {
  constructor(
    PGGConfig _pggConfig,
    uint256 _periodLengthInSeconds
  ) public PGGArbitratorStakeAccounting(_pggConfig, _periodLengthInSeconds) {

  }

  function setInitialTimestamp(uint256 _newInitialTimestamp) external {
    _initialTimestamp = _newInitialTimestamp;
  }
}
