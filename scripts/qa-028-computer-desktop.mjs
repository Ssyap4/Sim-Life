import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const out='/tmp/simlife-028-computer';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try{
  for(const role of ['alina','vlad']){
    for(const device of ['laptop','desktop']){
      const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:4173/qa-computer-028.html');
      await page.waitForFunction(()=>document.body.dataset.ready==='true');
      const desktop=page.locator('.computer-apps'),win=page.locator('.computer-window');
      const verify=async()=>{
        assert.equal(await desktop.isVisible(),true);
        assert.equal(await win.isVisible(),false);
        assert.equal(await desktop.evaluate(el=>el.scrollTop),0);
        assert.equal(await page.locator('#computer').getAttribute('data-owner'),role);
        assert.equal(await page.locator('#computer').getAttribute('data-device'),device);
        assert.equal(await desktop.locator('[data-computer-app]').count(),10);
      };
      await page.evaluate(([r,d])=>window.qa.open(r,d),[role,device]);await verify();
      // A trailing click from the canvas-opening tap cannot activate an app.
      await page.locator('[data-computer-app="career"]').evaluate(el=>el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1})));
      await verify();
      await page.locator('[data-computer-app="browser"]').tap();
      assert.equal(await win.isVisible(),true);
      await page.getByRole('button',{name:/Интернет и подключение/}).tap();
      assert.equal(await win.isVisible(),true);
      await page.locator('[data-computer-back]').tap();await verify();
      await page.locator('[data-computer-app="notes"]').tap();
      assert.equal(await win.isVisible(),true);
      await page.evaluate(()=>window.qa.refresh());
      assert.equal(await win.isVisible(),true);
      await page.locator('[data-computer-close]').tap();
      await page.evaluate(([r,d])=>window.qa.open(r,d),[role,device]);await verify();
      await page.screenshot({path:out+'/'+role+'-'+device+'.png'});
      assert.deepEqual(errors,[]);
      await page.close();
    }
  }
}finally{await browser.close();}
