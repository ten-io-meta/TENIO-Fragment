// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TENIOFragment is ERC721, Ownable {
    uint256 public nextTokenId = 1;

    // 0.10 ETH que se devolverá si el token se quema
    uint256 public constant COLLATERAL = 0.10 ether;

    // 0.01 ETH de fee para gas/infraestructura
    uint256 public constant FEE        = 0.01 ether;

    // 0.02 ETH de beneficio para el vendedor/propietario
    uint256 public constant PROFIT     = 0.02 ether;

    constructor() ERC721("TEN.IO Fragment", "TENFRAG") {}

    /**
     * @notice Crea un nuevo NFT. El usuario debe enviar EXACTAMENTE 0.13 ETH:
     *  - 0.10 ETH de colateral (se devolverá al quemar)
     *  - 0.01 ETH de fee (se queda en el contrato para cubrir costes)
     *  - 0.02 ETH de beneficio (se queda en el contrato como ganancia)
     */
    function mint() external payable {
        require(
            msg.value == COLLATERAL + FEE + PROFIT,
            "Precio incorrecto: se requieren 0.13 ETH"
        );

        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
    }

    /**
     * @notice Quema un token ERC-721 y devuelve al propietario solo el colateral (0.10 ETH).
     * @param tokenId El ID del NFT que el usuario posee.
     */
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "No eres el dueño de este token");
        _burn(tokenId);
        // Solo devolvemos 0.10 ETH (COLLATERAL). El resto (0.03 ETH) se queda en el contrato.
        payable(msg.sender).transfer(COLLATERAL);
    }

    /**
     * @notice Permite al propietario del contrato retirar todos los ETH acumulados
     *         (fees + profit) que hay en el balance.  
     * @param to Dirección destino donde se envían los fondos.
     */
    function withdraw(address payable to) external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No hay fondos que retirar");
        to.transfer(balance);
    }
}
