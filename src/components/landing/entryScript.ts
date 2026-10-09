// Runs before paint: hides the server-rendered landing when the visitor is likely
// to enter the app, so returning users don't see it flash. EntryGate makes the
// final decision and clears the flag when the landing should stay.
export const ENTRY_SCRIPT = `try{var p=new URLSearchParams(location.search),e=p.has("app")||p.has("code")||p.has("error")||p.has("local")||matchMedia("(display-mode: standalone)").matches;if(!e){for(var i=0;i<localStorage.length;i++){if(/^sb-.+-auth-token$/.test(localStorage.key(i))){e=true;break}}}if(e)document.documentElement.dataset.entry="app"}catch(_){}`;
