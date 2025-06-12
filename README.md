# 🧱 TENIO Blueprint v1.0 — Registro Público en Sepolia

> Registro fundacional del estándar NFT + valor colateral en Ethereum.  
> Este contrato ha sido desplegado en Sepolia y verificado públicamente como prueba de autoría y arquitectura base para futuros forks.

---

## 📌 Contrato

- **Dirección Sepolia:** [`0xCDBA2FF101F197B2F2FAC9571222FA47F2089EE3`](https://sepolia.etherscan.io/address/0xCDBA2FF101F197B2F2FAC9571222FA47F2089EE3)
- **Verificado en Etherscan:** ✅ *(cuando completes el paso de verificación)*
- **Compilador:** Solidity ^0.8.0
- **Licencia:** MIT
- **Dependencias:** OpenZeppelin `Ownable`

---

## 🧠 Propósito

TENIO.sol es un contrato base para la creación de NFTs con respaldo de valor nativo en ETH, orientado a:

- Experiencias narrativas digitales (fragmentos visuales/musicales)
- Mint limitado con quema opcional y supply vivo dinámico
- Integración futura con vaults y staking
- Estandarización fork-friendly para proyectos Web3 artísticos

Este contrato nace con la intención de que otros lo **forkeen**, **mejoren**, o **adapten** a sus propios metaversos, con la trazabilidad de que **TenIO fue el primero** en construir este patrón.

---

## ⚙️ Funciones activas

✔️ `mint(address to, uint256 amount)`  
✔️ `burn(uint256 amount)`  
✔️ `rescueETH(address payable to)`  
✔️ `receive()`  
✔️ `balanceOf(address)`  
✔️ `totalSupply`

---

## 🧪 Contexto de despliegue

- Esta versión es una implementación de pruebas en la red Sepolia
- No tiene valor real asignado
- Sirve como referencia, experimento abierto y base técnica verificable

---

## 🔒 Visión a futuro

El contrato incluye las bases para una arquitectura más amplia, incluyendo:

- NFTs con valor colateralizado
- Redención opcional vía quema
- Distribución justa de liquidez aportada por el creador
- Transparencia total y modularidad

---

## 🪪 Propiedad y fork

Este código está abierto bajo licencia MIT.  
Cualquier entidad, creador o comunidad puede:

- Usar este patrón como base
- Reconocer su origen en la cadena
- Contribuir a la evolución del estándar

```solidity
string public purpose = "This contract is designed to be forked. Build upon it. Respect the chain.";
