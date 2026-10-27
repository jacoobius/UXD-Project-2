export const round=value=>Math.round(value*10)/10;
export function mealTotals(meal){
 const result={kcal:0,protein:0,carbs:0,fat:0};
 for(const key of Object.keys(result)){
  if(meal.ingredients.some(i=>i[key]===null||i[key]===undefined)){result[key]=null;continue;}
  result[key]=round(meal.ingredients.reduce((n,i)=>n+i[key]*i.grams/100,0)/meal.servings);
 }
 return result;
}
export function validateMeal(meal){
 if(!meal||typeof meal.name!=='string'||!meal.name.trim()||meal.name.length>100)throw new Error('Give your meal a name of 1–100 characters.');
 if(!Number.isFinite(meal.servings)||meal.servings<=0||meal.servings>1000)throw new Error('Enter the number of servings this recipe makes (up to 1,000).');
 if(!Array.isArray(meal.ingredients)||!meal.ingredients.length||meal.ingredients.length>50)throw new Error('Add 1–50 ingredients.');
 for(const i of meal.ingredients){
  if(typeof i.name!=='string'||!i.name.trim()||i.name.length>300||!Number.isFinite(i.grams)||i.grams<=0||i.grams>100000)throw new Error('Each ingredient needs a name and a positive weight in grams.');
  if(!Number.isFinite(i.kcal)||i.kcal<0||i.kcal>1000)throw new Error('Enter calories per 100 g for each ingredient (0–1,000).');
  for(const k of ['protein','carbs','fat'])if(i[k]!=null&&(!Number.isFinite(i[k])||i[k]<0||i[k]>100))throw new Error('Ingredient macros must be 0–100 grams per 100 g, or blank.');
 }
 return {name:meal.name.trim(),servings:meal.servings,ingredients:meal.ingredients.map(i=>({name:i.name.trim(),grams:i.grams,kcal:i.kcal,protein:i.protein??null,carbs:i.carbs??null,fat:i.fat??null,sourceId:i.sourceId||null}))};
}
