import fs from 'node:fs';
import path from 'node:path';
const source=process.argv[2];
if(!source)throw new Error('Provide the extracted USDA SR Legacy CSV folder.');
function csv(file){
 const text=fs.readFileSync(path.join(source,file),'utf8');const rows=[];let row=[],field='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}
 if(field||row.length){row.push(field);rows.push(row);}const headers=rows.shift();return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]||''])));
}
const foods=new Map(csv('food.csv').map(f=>[f.fdc_id,{id:f.fdc_id,name:f.description,kcal:null,protein:null,carbs:null,fat:null,portions:[]}]));
const nutrients={1008:'kcal',1003:'protein',1004:'fat',1005:'carbs'};
for(const n of csv('food_nutrient.csv')){const food=foods.get(n.fdc_id),key=nutrients[n.nutrient_id];if(food&&key&&n.amount!=='')food[key]=Number(n.amount);}
for(const p of csv('food_portion.csv')){const f=foods.get(p.fdc_id);if(f&&Number(p.gram_weight)>0&&f.portions.length<5)f.portions.push({label:`${p.amount} ${p.modifier||p.portion_description||'portion'}`,grams:Number(p.gram_weight)});}
const data={source:'USDA FoodData Central · SR Legacy (April 2018)',url:'https://fdc.nal.usda.gov/download-datasets/',basis:'Nutrients per 100 g edible portion',foods:[...foods.values()].filter(f=>f.kcal!==null)};
fs.mkdirSync(new URL('../data/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../data/foods.json',import.meta.url),JSON.stringify(data));console.log(`${data.foods.length} foods compiled.`);
