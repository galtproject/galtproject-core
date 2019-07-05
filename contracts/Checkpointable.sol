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


contract Checkpointable {
  struct Checkpoint {
    uint128 fromBlock;
    uint128 value;
  }

  Checkpoint[] internal _cachedTotalSupply;
  mapping(address => Checkpoint[]) internal _cachedBalances;

  function _updateValueAtNow(Checkpoint[] storage checkpoints, uint256 _value) internal {
    if ((checkpoints.length == 0) || (checkpoints[checkpoints.length - 1].fromBlock < block.number)) {
      Checkpoint storage newCheckPoint = checkpoints[checkpoints.length++];
      newCheckPoint.fromBlock = uint128(block.number);
      newCheckPoint.value = uint128(_value);
    } else {
      Checkpoint storage oldCheckPoint = checkpoints[checkpoints.length - 1];
      oldCheckPoint.value = uint128(_value);
    }
  }

  function _getValueAt(Checkpoint[] storage checkpoints, uint _block) internal view returns (uint256) {
    if (checkpoints.length == 0) {
      return 0;
    }

    // Shortcut for the actual value
    if (_block >= checkpoints[checkpoints.length - 1].fromBlock) {
      return checkpoints[checkpoints.length - 1].value;
    }

    if (_block < checkpoints[0].fromBlock) {
      return 0;
    }

    // Binary search of the value in the array
    uint256 min = 0;
    uint256 max = checkpoints.length - 1;
    while (max > min) {
      uint mid = (max + min + 1) / 2;
      if (checkpoints[mid].fromBlock <= _block) {
        min = mid;
      } else {
        max = mid - 1;
      }
    }
    return checkpoints[min].value;
  }

  // GETTERS

  function _balanceOfAt(address _address, uint256 _blockNumber) internal view returns (uint256) {
    // These next few lines are used when the balance of the token is
    //  requested before a check point was ever created for this token, it
    //  requires that the `parentToken.balanceOfAt` be queried at the
    //  genesis block for that token as this contains initial balance of
    //  this token
    if ((_cachedBalances[_address].length == 0) || (_cachedBalances[_address][0].fromBlock > _blockNumber)) {
      // Has no parent
      return 0;
      // This will return the expected balance during normal situations
    } else {
      return _getValueAt(_cachedBalances[_address], _blockNumber);
    }
  }

  function _totalSupplyAt(uint256 _blockNumber) internal view returns (uint256) {
    // These next few lines are used when the totalSupply of the token is
    //  requested before a check point was ever created for this token, it
    //  requires that the `parentToken.totalSupplyAt` be queried at the
    //  genesis block for this token as that contains totalSupply of this
    //  token at this block number.
    if ((_cachedTotalSupply.length == 0) || (_cachedTotalSupply[0].fromBlock > _blockNumber)) {
      return 0;
      // This will return the expected totalSupply during normal situations
    } else {
      return _getValueAt(_cachedTotalSupply, _blockNumber);
    }
  }
}
