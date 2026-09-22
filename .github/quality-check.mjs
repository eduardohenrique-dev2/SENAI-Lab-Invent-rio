import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const ignored=new Set([".git","node_modules"]);
const textExtensions=new Set([".html",".js",".mjs",".ts",".css",".sql",".json",".md",".example"]);
const findings=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(ignored.has(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(textExtensions.has(path.extname(entry.name))||entry.name===".env.example"){
      checkFile(full);
    }
  }
}

function checkFile(file){
  const rel=path.relative(root,file).replaceAll("\\","/");
  const content=fs.readFileSync(file,"utf8");
  const lines=content.split(/\r?\n/);

  const executable=/\.(?:html|js|mjs|ts)$/i.test(file);

  lines.forEach((line,index)=>{
    if(/sb_secret_[A-Za-z0-9_-]{12,}/.test(line)){
      findings.push(`${rel}:${index+1} possível Secret Key versionada`);
    }

    if(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+["']/.test(line)){
      findings.push(`${rel}:${index+1} service role literal`);
    }

    if(executable&&/@latest(?:\/|["'])/.test(line)){
      findings.push(`${rel}:${index+1} dependência executável usando @latest`);
    }

    if(executable&&/@supabase\/supabase-js@2(?:["'\/]|\))/i.test(line)){
      findings.push(`${rel}:${index+1} Supabase JS sem versão exata`);
    }
  });

  if(file.endsWith(".sql")){
    lines.forEach((line,index)=>{
      if(/^\s*security\s+definer\b/i.test(line)){
        const nearby=lines.slice(index,index+8).join("\n");
        if(!/set\s+search_path/i.test(nearby)){
          findings.push(`${rel}:${index+1} SECURITY DEFINER sem SET search_path próximo`);
        }
      }
    });
  }
}

walk(root);

if(findings.length){
  console.error("Quality Gate falhou:\n- "+findings.join("\n- "));
  process.exit(1);
}

console.log("Quality Gate: sintaxe/política de segurança sem achados bloqueantes.");
