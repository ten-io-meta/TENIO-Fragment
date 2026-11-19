"use strict";
// Independent, read-only, fail-closed comparison of published TENIOFragment.sol
// with deployed Mainnet/Sepolia runtime bytecode. No keys, no tx signing.
const fs=require("node:fs"), path=require("node:path"), crypto=require("node:crypto");
const solc=require("solc");
const TARGETS=[
  {network:"mainnet",chainId:1,address:"0x7c88fabe05fd373d56a728f9896f87ede10db789",rpcs:["https://ethereum-rpc.publicnode.com","https://eth.drpc.org"]},
  {network:"sepolia",chainId:11155111,address:"0xD360714b72796dC812A0c177B9Be45022D1f3f5B",rpcs:["https://ethereum-sepolia-rpc.publicnode.com","https://1rpc.io/sepolia"]}
];
let reqId=0;
async function rpc(url,method,params){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const res=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:++reqId,method,params}),signal:controller.signal});
  if(!res.ok)throw Error("HTTP "+res.status);
  const data=await res.json();if(data.error)throw Error("RPC "+JSON.stringify(data.error).slice(0,170));return data.result;
 }finally{clearTimeout(timer);}
}
function imports(name){
 for(const candidate of [path.join("node_modules",name),path.join("contracts",name),name]){
  if(fs.existsSync(candidate))return {contents:fs.readFileSync(candidate,"utf8")};
 }
 return {error:"Missing import "+name};
}
const source=fs.readFileSync("contracts/TENIOFragment.sol","utf8");
function compile(optimizer,viaIR,evmVersion,metadata){
 const input={language:"Solidity",sources:{"contracts/TENIOFragment.sol":{content:source}},
 settings:{optimizer:{enabled:optimizer,runs:200},viaIR,metadata:{bytecodeHash:metadata},
 outputSelection:{"*":{"*":["evm.deployedBytecode.object","evm.bytecode.object","metadata"]}}}};
 if(evmVersion)input.settings.evmVersion=evmVersion;
 const out=JSON.parse(solc.compile(JSON.stringify(input),{import:imports}));
 const errors=(out.errors||[]).filter(x=>x.severity==="error");
 if(errors.length)throw Error(errors.map(x=>x.formattedMessage).join("\n").slice(0,3000));
 return out.contracts["contracts/TENIOFragment.sol"].TENIOFragment.evm.deployedBytecode.object.toLowerCase();
}
function stripMetadata(hex){
 // Solidity CBOR metadata is length-prefixed by last 2 bytes (big-endian).
 // Report full bytecode independently; stripping only aids triage and
 // MUST NOT be represented as an exact reproducible build.
 if(hex.length<4)return hex;
 const n=parseInt(hex.slice(-4),16);if(!Number.isFinite(n)||n<1||n>1024)return hex;
 const offset=hex.length-(n+2)*2;
 if(offset<0)return hex;
 const prefix=hex.slice(offset,offset+2);
 // CBOR map major type 5 starts with 0xa0..0xbf.
 if(!/^a[0-9a-f]$|^b[0-9a-f]$/.test(prefix))return hex;
 return hex.slice(0,offset);
}
function sha(s){return crypto.createHash("sha256").update(s).digest("hex");}
(async()=>{
 const compiler=solc.version(),observations=[];
 console.log("COMPILER "+compiler);
 if(!compiler.startsWith("0.8.28+"))throw Error("Must use solc 0.8.28; got "+compiler);
 for(const t of TARGETS){
  const endpoints=[];
  for(const url of t.rpcs){
   try{
    const chain=parseInt(await rpc(url,"eth_chainId",[]),16);
    if(chain!==t.chainId)throw Error("Wrong chain "+chain);
    const height=parseInt(await rpc(url,"eth_blockNumber",[]),16);
    const tag="0x"+(height-5).toString(16);
    const runtime=await rpc(url,"eth_getCode",[t.address,tag]);
    if(!runtime||runtime==="0x")throw Error("NO_CONTRACT_CODE");
    endpoints.push({url,block:height-5,code:runtime.slice(2).toLowerCase(),bytes:(runtime.length-2)/2});
   }catch(e){endpoints.push({url,error:String(e).slice(0,180)});}
  }
  const good=endpoints.filter(x=>x.code);
  const identical=good.length===2&&good[0].code===good[1].code;
  const rec={...t,providers:endpoints.map(({code,...rest})=>({...rest,runtimeSha256:code?sha(code):null})),independentRuntimeAgreement:identical, deployedRuntimeBytes:good[0]?.bytes||null};
  observations.push({rec,runtime:good[0]?.code||null});
  console.log("CHAIN "+t.network+" "+JSON.stringify(rec));
 }
 const compiled=[];
 for(const optimizer of [false,true]){
  for(const viaIR of [false,true]){
   for(const evmVersion of [null]){
    for(const metadata of ["ipfs","none"]){
     const id={optimizer,viaIR,evmVersion:evmVersion||"compiler-default",metadata};
     try{
      const runtime=compile(optimizer,viaIR,evmVersion,metadata);
      const comparison=observations.map(({rec, runtime:deployed})=>({
       network:rec.network,
       exactRuntimeMatch:!!deployed&&runtime===deployed,
       metadataStrippedMatch:!!deployed&&stripMetadata(runtime)===stripMetadata(deployed),
       compiledBytes:runtime.length/2,
       deployedBytes:rec.deployedRuntimeBytes
      }));
      compiled.push({settings:id,comparison});
      if(comparison.some(x=>x.exactRuntimeMatch||x.metadataStrippedMatch))
       console.log("MATCH_CANDIDATE "+JSON.stringify({settings:id,comparison}));
     }catch(e){compiled.push({settings:id,error:String(e).slice(0,220)});}
    }
   }
  }
 }
 const result={schema:"TENIO_FRAGMENT_SOURCE_RUNTIME_COMPARISON_V1",compiler,sourceSha256:sha(source),
  targets:observations.map(x=>x.rec),builds:compiled,
  exactMatches:compiled.filter(x=>x.comparison?.some(y=>y.exactRuntimeMatch)).map(x=>({settings:x.settings,comparison:x.comparison})),
  metadataStrippedMatches:compiled.filter(x=>x.comparison?.some(y=>y.metadataStrippedMatch)).map(x=>({settings:x.settings,comparison:x.comparison}))};
 fs.mkdirSync("audit-results",{recursive:true});
 fs.writeFileSync("audit-results/source-runtime-comparison.json",JSON.stringify(result,null,2)+"\n");
 console.log("AUDIT_SUMMARY "+JSON.stringify({independentProviders:observations.map(x=>({network:x.rec.network,agree:x.rec.independentRuntimeAgreement})),
  builds:compiled.length,exactMatches:result.exactMatches.length,metadataStrippedMatches:result.metadataStrippedMatches.length}));
 if(observations.some(x=>!x.rec.independentRuntimeAgreement))process.exitCode=2;
 // No exact match is a research result, NOT a CI failure: settings or
 // published source may differ. Never promote metadata-stripped to exact.
})().catch(e=>{console.error("AUDIT_FATAL",e);process.exitCode=1});
