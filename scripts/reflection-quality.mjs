export function cleanReflection(raw){
 return raw.replace(/^\s*#+\s*/gm,'').replace(/^\s*\d+[.)]\s*[^.\n]{0,40}:[ \t]*/gm,'').replace(/^\s*\d+[.)]\s+/gm,'').replace(/^\s*\*\*[^*\n]+\*\*:?[ \t]*$/gm,'').replace(/\*\*([^*\n]+)\*\*/g,'$1').replace(/^\s*[-*]\s+/gm,'').replace(/\s*\n\s*/g,' ').trim();
}
export function checkedReflection(raw,facts,fallback){
 const text=cleanReflection(raw);
 const numbers=s=>[...s.matchAll(/[+-]?\d[\d,]*(?:\.\d+)?/g)].map(m=>Math.abs(Number(m[0].replaceAll(',',''))));
 const allowed=new Set(numbers(facts));
 const supported=numbers(text).every(n=>allowed.has(n));
 const complete=text.split(/\s+/).length>=12&&/[.!]$/.test(text)&&(text.match(/:/g)||[]).length<3;
 const intakeJudgment=/\b(appropriate|adequate|healthy|safe|sufficient|moderate)\b/i.test(text);
 return complete&&supported&&!intakeJudgment&&!/\b(NaN|Infinity)\b/.test(text)?text:fallback;
}
