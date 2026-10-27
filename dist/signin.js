import {api} from './account.js';
const $=id=>document.getElementById(id);
let signup=false;
const requested=new URLSearchParams(location.search).get('next');
const next=['/index.html','/weight.html','/food.html','/lifts.html','/review.html','/'].includes(requested)?requested:'/index.html';
$('auth-toggle').addEventListener('click',()=>{
  signup=!signup;$('auth-title').textContent=signup?'A fresh start.':'Welcome back.';
  $('auth-intro').textContent=signup?'Create your account. Make a little room for you.':'Sign in to pick up where you left off.';
  $('auth-submit').textContent=signup?'Create account →':'Sign in →';
  $('auth-toggle').textContent=signup?'Sign in':'Create an account';
  $('switch-copy').textContent=signup?'Already have an account?':'New to steadily?';
  $('password').autocomplete=signup?'new-password':'current-password';
  $('auth-error').hidden=true;$('auth-status').textContent='';$('email').focus();
});
$('show-password').addEventListener('change',()=>{$('password').type=$('show-password').checked?'text':'password';});
$('auth-form').addEventListener('submit',async event=>{
  event.preventDefault();$('auth-error').hidden=true;$('auth-submit').disabled=true;$('auth-toggle').disabled=true;
  $('auth-status').textContent=signup?'Creating your account…':'Signing you in…';
  try{await api(signup?'signup':'login','POST',{email:$('email').value,password:$('password').value});location.replace(next);}
  catch(error){$('auth-error').textContent=error.message;$('auth-error').hidden=false;$('auth-status').textContent='';$('password').focus();}
  finally{$('auth-submit').disabled=false;$('auth-toggle').disabled=false;}
});
