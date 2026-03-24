// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

/// @title SimpleTarget
/// @notice Minimal contract used as a call target in gateway tests.
contract SimpleTarget {
    uint256 public callCount;

    function doSomething() external payable {
        callCount++;
    }

    function revertMe() external pure {
        revert("Intentional revert");
    }

    receive() external payable {}
}
