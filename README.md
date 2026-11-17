# 🧱 TENIO-Fragment

> **AVISO DE SEGURIDAD — CONTRATO HISTÓRICO, NO REFERENCIA ERC-8060 ESTRICTA (auditoría experimental, noviembre de 2026).**
> El contrato `TENIOFragment.sol` no implementa la interfaz `IERC721Value` del borrador ERC-8060.
> El propietario de la colección puede ejecutar `withdraw()` y retirar todo el saldo
> incluso si siguen existiendo NFTs. Si después se ejecuta `burn(tokenId)` con saldo
> inferior a 0,10 ETH, el NFT puede destruirse **sin pagar el ETH esperado**.
> Se ha reproducido en pruebas locales y las instrucciones EVM del código compilado
> coinciden exactamente con las desplegadas en Ethereum Mainnet y Sepolia, excluyendo
> los metadatos del compilador. **No utilizar este despliegue como garantía económica
> sin una evaluación de riesgo independiente; modificar GitHub NO modifica contratos desplegados.**
> Véase [informe de investigación](audit/REVIEW.md) y [PR de análisis](https://github.com/ten-io-meta/TENIO-Fragment/pull/3).

Este repositorio contiene el contrato oficial `TENIO-Fragment`, desplegado en Ethereum Mainnet, con ETH embebido y sistema de quema reversible.

---

## 📄 Contrato en Ethereum Mainnet

- **Dirección:** [`0x7c88fabe05fd373d56a728f9896f87ede10db789`](https://etherscan.io/address/0x7c88fabe05fd373d56a728f9896f87ede10db789)
- **Verificado:** ✅ en Etherscan
- **Propietario:** `0x75DA787FDA32092079dbe113c5c9DBC22CBBC455`
- **Fecha de deploy:** Junio 28, 2025
- **Licencia:** MIT

---

## 📦 Fragmento oficial: Crack in the Silence

### 🎨 Metadata JSON  
`ipfs://bafkreibzoqabzibuwjln6zhw5fab2s3skhm42sg5qqdeefiqopwpvut2ge`  
🔗 [Ver JSON en Pinata Gateway](https://gateway.pinata.cloud/ipfs/bafkreibzoqabzibuwjln6zhw5fab2s3skhm42sg5qqdeefiqopwpvut2ge)

### 💽 ZIP con prueba de autoría  
Incluido dentro del JSON (campo `"zip"`), contiene:

- `audio.wav`
- `letra.txt`
- `readme.txt` con prueba legal y timestamp

✅ Este ZIP queda como constancia pública en IPFS de la autoría creativa de TEN.IO sobre esta canción.

---

## 🌐 Versión de pruebas

Para validación pública y testeo sin ETH real:

- **Contrato en Sepolia:** [`0xD360714b72796dC812A0c177B9Be45022D1f3f5B`](https://sepolia.etherscan.io/address/0xD360714b72796dC812A0c177B9Be45022D1f3f5B)
- **Web interactiva:** [https://tenio-frontend-nuevo.vercel.app](https://tenio-frontend-nuevo.vercel.app)

---

## 🔁 Fork origin

> “This contract is a fork of [TEN.IO](https://ten.io), the first NFT contract signed on Ethereum Mainnet with embedded ETH collateral and reversible burn.”

---

## ✍️ Propósito

TEN.IO no vende tokens ni hace farming.  
Cada fragmento es un acto de culto digital, respaldado en la red.

> No farming. No promises.  
> Just fragments of truth.  
> **TEN.IO — The network never forgets.**
