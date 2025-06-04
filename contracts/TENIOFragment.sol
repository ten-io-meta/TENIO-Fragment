// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TENIOFragment is ERC721, Ownable, ReentrancyGuard {
    uint256 public nextTokenId = 1;

    // Sólo retenemos 0.10 ETH de colateral y 0.02 ETH de beneficio
    uint256 public constant COLLATERAL = 0.10 ether; // ETH bloqueado por token
    uint256 public constant PROFIT     = 0.02 ether; // ETH de beneficio para el owner

    // Variables para separar “colateral” vs “beneficio”:
    uint256 public totalCollateral; // Suma de todos los COLLATERAL bloqueados
    uint256 public ownerBalance;    // Suma de todos los PROFIT que puede retirar el owner

    // -------------------------------------------------
    // Eventos
    // -------------------------------------------------
    event Minted(address indexed minter, uint256 tokenId);
    event Burned(address indexed burner, uint256 tokenId);
    event Withdrawn(address indexed owner, uint256 amount);

    // En vez de pasar los parámetros en la línea del contract,
    // los pasamos aquí en el constructor:
    constructor()
        ERC721("TEN.IO Fragment", "TENFRAG")
        Ownable(msg.sender)
    {
        // cuerpo vacío
    }

    /**
     * @notice   Mint de un token ERC-721: bloquea 0.12 ETH (0.10 + 0.02)
     * @dev      - 0.10 ETH va a totalCollateral
     *           - 0.02 ETH (profit) va a ownerBalance
     */
    function mint() external payable {
        require(msg.value == (COLLATERAL + PROFIT), "Se requieren 0.12 ETH");

        // 1) Incrementamos el colateral bloqueado
        totalCollateral += COLLATERAL;

        // 2) Registramos el beneficio para el owner
        ownerBalance += PROFIT;

        // 3) Creamos el NFT
        uint256 tokenId = nextTokenId++;
        _safeMint(msg.sender, tokenId);
        emit Minted(msg.sender, tokenId);
    }

    /**
     * @notice   Quema un token ERC-721 y devuelve solo los 0.10 ETH de COLLATERAL
     * @param    tokenId  ID del NFT que el usuario posee
     * @dev      - Restamos totalCollateral en 0.10 ETH
     *           - Transferimos esos 0.10 ETH al quemador
     */
    function burn(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "No eres el dueño");
        _burn(tokenId);

        // 1) Reducimos el colateral
        totalCollateral -= COLLATERAL;

        // 2) Devolvemos SOLO el colateral (0.10 ETH)
        (bool sent, ) = payable(msg.sender).call{ value: COLLATERAL }("");
        require(sent, "Fallo al devolver colateral");
        emit Burned(msg.sender, tokenId);
    }

    /**
     * @notice  Permite al owner retirar SOLO el PROFIT acumulado
     * @param   to    Dirección destino donde se envían los fondos del owner
     * @dev     ownerBalance contiene únicamente PROFIT de todas las operaciones mint
     */
    function withdraw(address payable to) external nonReentrant onlyOwner {
        uint256 amount = ownerBalance;
        require(amount > 0, "No hay beneficios que retirar");

        // Primero ponemos a cero para evitar reentradas
        ownerBalance = 0;

        // Transferimos SOLO los beneficios (profit)
        (bool sent, ) = to.call{ value: amount }("");
        require(sent, "Fallo al retirar beneficios");
        emit Withdrawn(to, amount);
    }

    /**
     * @notice Bloquea la recepción de ETH sin función explícita
     */
    receive() external payable {
        revert("No acepto pagos directos");
    }
}
