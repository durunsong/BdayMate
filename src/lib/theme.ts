// Fixed, non-user-supplied bootstrap runs before first paint, including when storage is blocked.
export const themeBootstrap =
  "(()=>{let p='system';try{const v=localStorage.getItem('bdaymate-theme');if(v==='light'||v==='dark')p=v}catch{}const t=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;const r=document.documentElement;r.dataset.theme=t;r.dataset.themePreference=p;r.style.colorScheme=t})()";
