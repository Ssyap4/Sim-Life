// Keep the initial cover independent of the heavy game bundle.
void import('./main').catch(error=>{
  console.error(error);
  const app=document.querySelector('#app');
  if(app)app.innerHTML='<div id="boot-cover" role="alert"><strong>SimOurHome</strong><p>Не удалось загрузить игру.</p><a href="">Попробовать снова</a></div>';
});
