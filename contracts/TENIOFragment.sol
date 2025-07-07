// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TENIOFragment is ERC721URIStorage, Ownable {
    uint256 public tokenIds;

    constructor() ERC721("TENIO", "TENIO") Ownable(msg.sender) {}

    function mintFragment(string memory uri) external payable {
        require(msg.value == 0.12 ether, "Debes enviar exactamente 0.12 ETH");

        tokenIds++;
        uint256 newItemId = tokenIds;

        _safeMint(msg.sender, newItemId);
        _setTokenURI(newItemId, uri);
    }

    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "No eres el propietario del token");

        _burn(tokenId);

        uint256 balance = address(this).balance;
        if (balance >= 0.10 ether) {
            payable(msg.sender).transfer(0.10 ether);
        }
    }

    function withdraw() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
