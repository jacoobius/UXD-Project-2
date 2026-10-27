import {api} from './account.js';
import {mealTotals,validateMeal,round} from './nutrition.js';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
export async function setupFoodLibrary({user,prefill}){
 let meals=[],editing=null,deleted=null,recipeDirty=false,calculation=null;
 function calories(){
  if(!calculation)return;const qty=Number($('quantity').value),unit=$('unit').value;
  if(unit===calculation.unit)$('calories').value=Number.isFinite(qty)?round(qty*calculation.perUnit):'';
  else if(calculation.unit==='g'&&unit==='oz')$('calories').value=round(qty*28.349523125*calculation.perUnit);
  else{$('calories').value='';calculation=null;$('food-search-status').textContent='Enter total calories for the unit you selected.';}
 }
 $('quantity').addEventListener('input',calories);$('unit').addEventListener('change',calories);$('calories').addEventListener('input',()=>{calculation=null;});
 $('log-form').addEventListener('reset',()=>{calculation=null;});document.addEventListener('clear-food-selection',()=>{calculation=null;});
 function useFood(food){if(prefill({name:food.name.slice(0,100),quantity:100,unit:'g',calories:food.kcal})){calculation={unit:'g',perUnit:food.kcal/100};$('food-search-status').textContent='Added to the log form below. Adjust grams and save when ready.';}}
 $('food-search-form').addEventListener('submit',async event=>{
  event.preventDefault();$('food-search-button').disabled=true;$('food-search-status').textContent='Searching the USDA catalog…';$('food-results').replaceChildren();
  try{
   const result=await api(`foods?q=${encodeURIComponent($('food-query').value)}`);
   $('food-search-status').textContent=result.total?`${result.total} matches. Showing ${result.foods.length}.`:'No matches. Try a simpler food name, or enter it manually below.';
   for(const f of result.foods){
    const item=el('article','food-result'),h=el('h3','',f.name),info=el('p','hint',`${f.kcal} kcal · ${f.protein??'—'} g protein per 100 g`),actions=el('div','food-result-actions');
    const use=el('button','text-button','Use in log');use.type='button';use.setAttribute('aria-label',`Use ${f.name} in log`);use.onclick=()=>useFood(f);
    const add=el('button','text-button','Add to recipe');add.type='button';add.setAttribute('aria-label',`Add ${f.name} to recipe`);add.onclick=()=>{if($('meal-builder').hidden)openBuilder();addIngredient({...f,sourceId:f.id,grams:100});recipeDirty=true;$('meal-builder-title').focus();};
    actions.append(use,add);item.append(h,info,actions);$('food-results').append(item);
   }
  }catch(error){$('food-search-status').textContent=error.message;}finally{$('food-search-button').disabled=false;}
 });
 function readIngredients(){return [...$('recipe-ingredients').children].map(row=>({...row.ingredient,name:row.querySelector('[data-field="name"]').value,grams:Number(row.querySelector('[data-field="grams"]').value),kcal:row.querySelector('[data-field="kcal"]').value===''?null:Number(row.querySelector('[data-field="kcal"]').value)}));}
 function totals(){const meal={servings:Number($('recipe-servings').value),ingredients:readIngredients()};try{validateMeal({...meal,name:'Recipe'});const t=mealTotals(meal);$('recipe-total').textContent=`${t.kcal} kcal per serving${t.protein!==null?` · ${t.protein} g protein`:''}`;}catch{$('recipe-total').textContent='Complete your ingredients to calculate calories per serving.';}}
 function labelRows(){[...$('recipe-ingredients').children].forEach((row,i)=>{for(const input of row.querySelectorAll('input'))input.setAttribute('aria-label',`${input.dataset.field==='name'?'Ingredient':input.dataset.field==='grams'?'Grams':'Calories per 100 g'}, row ${i+1}`);row.querySelector('button').setAttribute('aria-label',`Remove ingredient row ${i+1}`);});}
 function addIngredient(value={}){
  const row=el('tr');row.ingredient={protein:value.protein??null,carbs:value.carbs??null,fat:value.fat??null,sourceId:value.sourceId||null};
  for(const field of ['name','grams','kcal']){const td=el('td'),input=el('input');input.dataset.field=field;input.type=field==='name'?'text':'number';input.required=true;if(field==='name'){input.maxLength=300;input.value=value.name||'';}else{input.step='any';input.min=field==='grams'?'0.1':'0';input.max=field==='grams'?'100000':'1000';input.value=value[field]??(field==='grams'?100:'');}input.addEventListener('input',()=>{recipeDirty=true;if(field==='name'||field==='kcal')row.ingredient={protein:null,carbs:null,fat:null,sourceId:null};totals();});td.append(input);row.append(td);}
  const td=el('td'),remove=el('button','text-button','Remove');remove.type='button';remove.onclick=()=>{row.remove();recipeDirty=true;labelRows();totals();$('add-ingredient').focus();};td.append(remove);row.append(td);$('recipe-ingredients').append(row);labelRows();totals();
 }
 function openBuilder(meal=null){
  if(recipeDirty&&!confirm('Replace your unsaved recipe?'))return false;editing=meal;recipeDirty=false;$('meal-builder').hidden=false;$('recipe-name').value=meal?.name||'';$('recipe-servings').value=meal?.servings||1;$('recipe-ingredients').replaceChildren();$('recipe-error').hidden=true;$('meal-builder-title').textContent=meal?'Edit your meal':'Create a meal';for(const i of meal?.ingredients||[])addIngredient(i);totals();return true;
 }
 $('new-meal').onclick=()=>{if(openBuilder()){$('recipe-name').focus();}};
 $('add-ingredient').onclick=()=>{addIngredient();recipeDirty=true;$('recipe-ingredients').lastElementChild.querySelector('input').focus();};
 $('recipe-form').addEventListener('input',()=>{recipeDirty=true;totals();});
 $('cancel-recipe').onclick=()=>{if(recipeDirty&&!confirm('Discard this unsaved recipe?'))return;$('meal-builder').hidden=true;recipeDirty=false;editing=null;$('new-meal').focus();};
 $('recipe-form').addEventListener('submit',async event=>{
  event.preventDefault();$('recipe-error').hidden=true;$('save-recipe').disabled=true;
  try{const meal=validateMeal({name:$('recipe-name').value,servings:Number($('recipe-servings').value),ingredients:readIngredients()});await api('meals',editing?'PUT':'POST',{...meal,userId:user.id,...(editing?{id:editing.id,revision:editing.revision}:{})});recipeDirty=false;$('meal-builder').hidden=true;editing=null;await refresh();$('meal-status').textContent='Meal saved. Use it in your log whenever you like.';$('new-meal').focus();}
  catch(error){$('recipe-error').textContent=error.message;$('recipe-error').hidden=false;}finally{$('save-recipe').disabled=false;}
 });
 async function refresh(){
  meals=(await api('meals')).meals;$('saved-meals').replaceChildren();
  if(!meals.length)$('saved-meals').append(el('p','meal-empty','Your go-to recipes belong here. Create your first meal.'));
  for(const meal of meals){const item=el('article','saved-meal'),total=mealTotals(meal);item.append(el('h4','',meal.name),el('p','hint',`${total.kcal} kcal per serving · makes ${meal.servings} servings`));const actions=el('div','food-result-actions');
   for(const action of ['Use in log','Edit','Delete']){const button=el('button','text-button',action);button.type='button';button.setAttribute('aria-label',`${action} ${meal.name}`);button.onclick=async()=>{
    if(action==='Use in log'){if(prefill({name:meal.name,quantity:1,unit:'serving',calories:total.kcal})){calculation={unit:'serving',perUnit:total.kcal};$('meal-status').textContent='Meal copied to your log. Adjust servings and save.';}}
    else if(action==='Edit'){if(openBuilder(meal))$('recipe-name').focus();}
    else{try{await api('meals','DELETE',{userId:user.id,id:meal.id,revision:meal.revision});deleted=meal;await refresh();$('undo-meal-delete').hidden=false;$('meal-status').textContent='Meal deleted. Undo is available until you leave this page.';}catch(e){$('meal-status').textContent=e.message;}}
   };actions.append(button);}item.append(actions);$('saved-meals').append(item);
  }
 }
 $('undo-meal-delete').onclick=async()=>{try{await api('meals','POST',{...deleted,userId:user.id});deleted=null;$('undo-meal-delete').hidden=true;await refresh();$('meal-status').textContent='Meal restored.';}catch(e){$('meal-status').textContent=e.message;}};
 window.addEventListener('beforeunload',event=>{if(recipeDirty){event.preventDefault();event.returnValue='';}});
 try{await refresh();}catch(error){$('meal-status').textContent=error.message;}
}
