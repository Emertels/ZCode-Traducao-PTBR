const fs = require('fs');
const path = require('path');
const installOrArchive = process.argv[2] || path.join(process.env.LOCALAPPDATA || '', 'Programs', 'ZCode');
const archive = fs.statSync(installOrArchive).isDirectory() ? path.join(installOrArchive, 'resources', 'app.asar') : installOrArchive;
const limit = Number(process.argv[3] || 100);
const dictionary = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pt_dictionary.json'), 'utf8'));
const fd = fs.openSync(archive, 'r');
try {
  const prefix=Buffer.alloc(16);fs.readSync(fd,prefix,0,16,0);const headerSize=prefix.readUInt32LE(4),jsonSize=prefix.readUInt32LE(12),headerBytes=Buffer.alloc(jsonSize);fs.readSync(fd,headerBytes,0,jsonSize,16);const header=JSON.parse(headerBytes.toString('utf8')),baseOffset=8+headerSize;
  function getEntry(filePath){let cur=header;for(const part of filePath.split('/')){cur=cur.files&&cur.files[part];if(!cur)return null}return cur}
  function read(entry){const data=Buffer.alloc(entry.size);fs.readSync(fd,data,0,entry.size,baseOffset+Number(entry.offset));return data.toString('utf8')}
  const version=JSON.parse(read(getEntry('package.json')).replace(/^[^{]*/, '')).version;
  const assets=header.files?.out?.files?.renderer?.files?.assets?.files||{};const intlName=Object.keys(assets).find(name=>name.startsWith('IntlProvider')&&name.endsWith('.js'));if(!intlName)throw Error('IntlProvider bundle não encontrado.');
  const intl=read(getEntry(`out/renderer/assets/${intlName}`));const messages=new Map();
  const property=/("(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$.-]*)\s*:\s*`([^`]{1,500})`/g;
  for(const m of intl.matchAll(property)){const key=m[1][0]==='"'?m[1].slice(1,-1).replace(/\\"/g,'"').replace(/\\n/g,' '):m[1];const value=m[2].replace(/\\n/g,' ').replace(/\\t/g,' ').trim();if(/[A-Za-z]{3}/.test(value)&&!/[\u3400-\u9fff]/.test(value))messages.set(key,value)}
  const missing=[...messages].filter(([key,value])=>key!=='client'&&!/^\/?[A-Za-z0-9._/-]+$/.test(value)&&!Object.hasOwn(dictionary,key)&&!Object.hasOwn(dictionary,value)).map(([key,value])=>({key,value})).sort((a,b)=>a.key.localeCompare(b.key));
  console.log(`ZCode ${version} | ${intlName}`);console.log(`Mensagens em inglês mapeadas por ID: ${messages.size}; sem tradução por ID ou texto: ${missing.length}`);
  for(const m of missing.slice(0,limit))console.log(`- ${m.key}: ${m.value}`);if(missing.length>limit)console.log(`... ${missing.length-limit} itens adicionais (use um limite maior como segundo argumento).`);
}finally{fs.closeSync(fd)}

