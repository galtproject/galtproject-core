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

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "../registries/GaltGlobalRegistry.sol";
import "../registries/interfaces/IFeeRegistry.sol";
import "../ContourVerifiers.sol";


contract ContourVerificationManager is OwnableAndInitializable {
  using SafeMath for uint256;

  bytes32 public constant FEE_KEY = bytes32("CONTOUR_VERIFICATION");

  event SetRequiredConfirmations(uint256 requiredConfirmations);

  enum Action {
    ADD,
    REMOVE
  }

  enum Status {
    NULL,
    PENDING,
    APPROVED,
    REJECTED
  }

  struct Contour {
    Status status;
    uint256[] contour;
    address[] validators;
    mapping(address => bool) validatorVoted;
    Action action;
    uint256 requiredConfirmations;
    uint256 approvalCount;
    uint256 rejectionCount;
  }

  uint256 public requiredConfirmations;
  GaltGlobalRegistry internal ggr;

  mapping(uint256 => Contour) public addQueue;

  // .......(TAIL)....queue.....(HEAD) ->
  // contour id for a new pushed contour
  uint256 public head;
  // current contour id to be reviewed by oracles
  uint256 public tail;

  modifier onlyValidContourVerifier(address _verifier) {
    require(
      ContourVerifiers(ggr.getContourVerifiersAddress()).isVerifierValid(_verifier, msg.sender),
      "Invalid operator"
    );

    _;
  }

  function initialize(GaltGlobalRegistry _ggr, uint256 _requiredConfirmations) external isInitializer {
    ggr = _ggr;
    requiredConfirmations = _requiredConfirmations;
  }

  // OWNER INTERFACE

  function setRequiredConfirmations(uint256 _requiredConfirmations) external onlyOwner {
    requiredConfirmations = _requiredConfirmations;
    emit SetRequiredConfirmations(_requiredConfirmations);
  }

  // USER INTERFACE

  function submit(uint256[] calldata _contour) external {
    require(_contour.length >= 3, "Contour should have at least 3 vertices");

    _acceptPayment();

    uint256 id = head;
    head += 1;

    Contour storage contour = addQueue[id];
    require(contour.status == Status.NULL, "Application already exists");

    contour.status = Status.PENDING;
    contour.contour = _contour;
    contour.requiredConfirmations = requiredConfirmations;
  }

  function approve(uint256 _id, address _verifier) external onlyValidContourVerifier(_verifier) {
    Contour storage contour = addQueue[_id];

    uint256 currentId = tail;

    require(_id == currentId, "ID mismatches with the current");
    require(contour.status == Status.PENDING, "Expect PENDING status");
    require(contour.validatorVoted[msg.sender] == false, "Operator has already verified the contour");

    contour.validatorVoted[msg.sender] = true;
    contour.validators.push(msg.sender);
    contour.approvalCount += 1;

    if (contour.approvalCount == contour.requiredConfirmations) {
      contour.status = Status.APPROVED;
      tail += 1;
    }
  }

  function reject(uint256 _id, address _verifier) external onlyValidContourVerifier(_verifier) {
    Contour storage contour = addQueue[_id];

    uint256 currentId = tail;

    require(_id == currentId, "ID mismatches with the current");
    require(contour.status == Status.PENDING, "Expect PENDING status");
    require(contour.validatorVoted[msg.sender] == false, "Operator has already verified the contour");

    contour.validatorVoted[msg.sender] = true;
    contour.validators.push(msg.sender);
    contour.rejectionCount += 1;

    if (contour.rejectionCount == contour.requiredConfirmations) {
      contour.status = Status.REJECTED;
      tail += 1;
    }
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

  // GETTERS

}
