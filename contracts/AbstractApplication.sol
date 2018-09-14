pragma solidity 0.4.24;
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
pragma experimental "v0.5.0";

contract AbstractApplication is Ownable {
  PaymentMethod public paymentMethod;
  uint256 public minimalApplicationFeeInEth;
  uint256 public minimalApplicationFeeInGalt;
  uint256 public galtSpaceEthShare;
  uint256 public galtSpaceGaltShare;
  address internal galtSpaceRewardsAddress;

  mapping(address => bool) public feeManagers;

  enum Currency {
    ETH,
    GALT
  }

  enum PaymentMethod {
    NONE,
    ETH_ONLY,
    GALT_ONLY,
    ETH_AND_GALT
  }

  modifier onlyFeeManager() {
    require(feeManagers[msg.sender] == true, "Not a fee manager");
    _;
  }

  function setFeeManager(address _feeManager, bool _active) external onlyOwner {
    feeManagers[_feeManager] = _active;
  }

  function setGaltSpaceRewardsAddress(address _newAddress) external onlyOwner {
    galtSpaceRewardsAddress = _newAddress;
  }

  function setPaymentMethod(PaymentMethod _newMethod) external onlyFeeManager {
    paymentMethod = _newMethod;
  }

  function setMinimalApplicationFeeInEth(uint256 _newFee) external onlyFeeManager {
    minimalApplicationFeeInEth = _newFee;
  }

  function setMinimalApplicationFeeInGalt(uint256 _newFee) external onlyFeeManager {
    minimalApplicationFeeInGalt = _newFee;
  }

  function setGaltSpaceEthShare(uint256 _newShare) external onlyFeeManager {
    require(_newShare >= 1, "Percent value should be greater or equal to 1");
    require(_newShare <= 100, "Percent value should be greater or equal to 100");

    galtSpaceEthShare = _newShare;
  }

  function setGaltSpaceGaltShare(uint256 _newShare) external onlyFeeManager {
    require(_newShare >= 1, "Percent value should be greater or equal to 1");
    require(_newShare <= 100, "Percent value should be greater or equal to 100");

    galtSpaceGaltShare = _newShare;
  }
}
