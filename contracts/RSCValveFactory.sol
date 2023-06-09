// SPDX-License-Identifier: BSL 1.1

pragma solidity 0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RSCValve.sol";

/// @title RSCValve factory contract.
/// @notice Used to deploy RSCValve contracts.
contract RSCValveFactory is AccessControl {
    /// Measurement unit 10000000 = 100%.
    uint256 public constant BASIS_POINT = 10000000;

    /// Maximum fee value 5000000 = 50%.
    uint256 public constant FEE_BOUND = 5000000;

    /// RSCValve implementation address.
    RSCValve public immutable contractImplementation;

    /// RSCValveFactory contract version.
    bytes32 public constant VERSION = "1.0";

    /// Current platform fee.
    uint256 public platformFee;

    /// Fee receiver address.
    address payable public platformWallet;

    /// RSCValve creation data struct.
    struct RSCValveCreateData {
        /// Address of the controller (sets recipients).
        address controller;
        /// Address of the distributors.
        address[] distributors;
        /// Whether the recipients are modifiable or not.
        bool isImmutableRecipients;
        /// Whether distribution is triggered on receive().
        bool isAutoNativeCurrencyDistribution;
        /// Minimal amount to trigger auto distribution.
        uint256 minAutoDistributeAmount;
        /// Initial array of recipients addresses.
        RSCValve.RecipientData[] recipients;
        /// Creation id.
        bytes32 creationId;
    }

    /// Emitted when a new RSCValve is deployed.
    event NewRSCValve(
        address contractAddress,
        address controller,
        address[] distributors,
        bytes32 indexed version,
        bool isImmutableRecipients,
        bool isAutoNativeCurrencyDistribution,
        uint256 minAutoDistributeAmount,
        bytes32 indexed creationId
    );

    /// Emitted when a platform fee is set.
    event PlatformFee(uint256 newFee);

    /// Emitted when a platform wallet is set.
    event PlatformWallet(address payable newPlatformWallet);

    /** @notice Creates RSCValveFactory contract.
     * @dev Deploys current RSCValve implementation contract
     * and sets its address to `contractImplementation`.
     */
    constructor() {
        contractImplementation = new RSCValve();
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Public function for creating clone proxy pointing to RSC Percentage.
     * @param _data Initial data for creating new RSC Valve contract.
     */
    function createRSCValve(RSCValveCreateData memory _data) external returns (RSCValve) {
        // check and register creationId
        bytes32 creationId = _data.creationId;
        address payable clone;
        if (creationId != bytes32(0)) {
            bytes32 salt = _getSalt(_data, msg.sender);
            clone = payable(
                Clones.cloneDeterministic(address(contractImplementation), salt)
            );
        } else {
            clone = payable(Clones.clone(address(contractImplementation)));
        }

        RSCValve(clone).initialize(
            msg.sender,
            _data.controller,
            _data.distributors,
            _data.isImmutableRecipients,
            _data.isAutoNativeCurrencyDistribution,
            _data.minAutoDistributeAmount,
            platformFee,
            _data.recipients
        );

        emit NewRSCValve(
            clone,
            _data.controller,
            _data.distributors,
            VERSION,
            _data.isImmutableRecipients,
            _data.isAutoNativeCurrencyDistribution,
            _data.minAutoDistributeAmount,
            creationId
        );

        return RSCValve(clone);
    }

    /**
     * @dev Admin function for setting platform fee.
     * @param _fee Percentage define platform fee 100% == BASIS_POINT.
     */
    function setPlatformFee(uint256 _fee) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_fee > FEE_BOUND || _fee == platformFee) {
            revert InvalidPercentageError(_fee);
        }
        emit PlatformFee(_fee);
        platformFee = _fee;
    }

    /**
     * @dev Admin function for setting platform fee.
     * @param _platformWallet New native currency wallet which will receive fee.
     */
    function setPlatformWallet(
        address payable _platformWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_platformWallet == address(0)) {
            revert NullAddressError();
        }
        if (_platformWallet != platformWallet) {
            emit PlatformWallet(_platformWallet);
            platformWallet = _platformWallet;
        }
    }

    /**
     * @dev External function for creating clone proxy pointing to RSC Percentage.
     * @param _data RSC Create data used for hashing and getting random salt.
     * @param _deployer Wallet address that want to create new RSC contract.
     */
    function predictDeterministicAddress(
        RSCValveCreateData memory _data,
        address _deployer
    ) external view returns (RSCValve) {
        bytes32 salt = _getSalt(_data, _deployer);
        address predictedAddress = Clones.predictDeterministicAddress(
            address(contractImplementation),
            salt
        );
        return RSCValve(payable(predictedAddress));
    }

    /**
     * @dev Internal function for getting semi-random salt for deterministicClone creation.
     * @param _data RSC Create data used for hashing and getting random salt.
     * @param _deployer Wallet address that want to create new RSC contract.
     */
    function _getSalt(
        RSCValveCreateData memory _data,
        address _deployer
    ) internal pure returns (bytes32) {
        bytes32 hash = keccak256(
            abi.encode(
                _data.controller,
                _data.distributors,
                _data.isImmutableRecipients,
                _data.isAutoNativeCurrencyDistribution,
                _data.minAutoDistributeAmount,
                _data.recipients,
                _data.creationId,
                _deployer
            )
        );
        return hash;
    }
}
