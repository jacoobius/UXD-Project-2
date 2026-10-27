export async function api(path,method='GET',data) {
  const response=await fetch(`/api/${path}`,{method,credentials:'same-origin',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
  const result=await response.json();
  if(!response.ok)throw new Error(result.error||'Unable to connect. Please try again.');
  return result;
}
export async function setupAccount() {
  try{
    const {user}=await api('session');
    if(!user){location.replace(`/signin.html?next=${encodeURIComponent(location.pathname)}`);return null;}
    const email=document.getElementById('account-email');if(email)email.textContent=user.email;
    document.getElementById('sign-out').addEventListener('click',async()=>{
      if(!confirm('Sign out? Any unsaved entries will be discarded.'))return;
      try{await api('logout','POST',{});location.href='/signin.html';}
      catch(error){const box=document.getElementById('storage-error');box.hidden=false;box.textContent=error.message;}
    });
    // A back/forward cache restoration must not expose the last account's journal.
    window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
    return user;
  }catch(error){const box=document.getElementById('storage-error');box.hidden=false;box.textContent='Cannot connect to your account. Reload this page to try again.';return null;}
}
