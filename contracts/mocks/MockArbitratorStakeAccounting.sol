pragma solidity 0.5.3;

import "../multisig/ArbitratorStakeAccounting.sol";


contract MockArbitratorStakeAccounting is ArbitratorStakeAccounting {
  constructor(
    ERC20 _galtToken,
    ArbitratorsMultiSig _multiSigWallet,
    uint256 _periodLengthInSeconds
  ) public ArbitratorStakeAccounting(_galtToken, _multiSigWallet, _periodLengthInSeconds) {

  }

  function setInitialTimestamp(uint256 _newInitialTimestamp) external {
    _initialTimestamp = _newInitialTimestamp;
  }
}
