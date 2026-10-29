const {chromium}=require('/Users/mugikura/node_modules/playwright');
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
// Live check against the deployed billing worker (Stripe test mode). Not part of the test suite:
// it talks to the real server and Stripe. Run with: node tools/billing-live-check.cjs [canceled-test-purchase-id]
// - unpacked build switched to the real purchase check (pwm_billing_live_test)
// - settings card: free status, buy opens Stripe Checkout with the Pro product and price
// - an id carried over from a canceled test purchase shows "free" and can open the customer portal
(async()=>{
 const canceledId=process.argv[2]||'';
 const dir=fs.mkdtempSync(path.join(process.env.TMPDIR||os.tmpdir(),'billing-live-'));
 const context=await chromium.launchPersistentContext(dir,{headless:true,executablePath:chromium.executablePath(),args:[`--load-extension=${path.resolve('extension')}`],ignoreDefaultArgs:['--disable-extensions']});context.setDefaultTimeout(20000);
 try{
  const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');const id=worker.url().split('/')[2];
  assert.equal(id,'ofpnbokbnlfjglogdhoegmiallanobdb','extension id must match ALLOWED_ORIGINS on the worker');
  await worker.evaluate(()=>chrome.storage.local.set({pwm_billing_live_test:true}));
  const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.setViewportSize({width:1280,height:800});
  await p.goto(`chrome-extension://${id}/dashboard.html`);await p.waitForFunction(()=>g_dashboardWindowId!==null);
  await p.locator('#openSettings').click();
  await p.waitForFunction(()=>document.getElementById('billingStatus').textContent.includes('無料版'));
  assert.equal(await p.locator('#billingBuy').isVisible(),true);
  console.log('PASS free status from the real server:',await p.locator('#billingStatus').textContent());
  await p.locator('.billing-settings').screenshot({path:'evidence/billing-card-free.png'});
  for(const href of await p.locator('#billingLegal a').evaluateAll(a=>a.map(x=>x.href))){
   const res=await fetch(href);assert.equal(res.status,200,href);
  }
  console.log('PASS terms / 特商法 / privacy links next to the buy button all open (200)');
  const [checkout]=await Promise.all([context.waitForEvent('page'),p.locator('#billingBuy').click()]);
  await checkout.waitForLoadState('domcontentloaded');
  assert.match(checkout.url(),/^https:\/\/checkout\.stripe\.com\/c\/pay\/cs_(test|live)_/);
  await checkout.getByText('Tab Matomen Kai Pro').first().waitFor();
  await checkout.getByText(/300/).first().waitFor();
  await checkout.waitForTimeout(3000); // let the skeleton finish rendering
  await checkout.screenshot({path:'evidence/billing-checkout-test.png'});
  console.log('PASS buy opens Stripe Checkout for Tab Matomen Kai Pro, ¥300');
  await checkout.close();
  if(canceledId){
   await p.locator('.billing-id summary').click();
   await p.locator('#billingIdInput').fill(canceledId);await p.locator('#billingIdApply').click();
   await p.waitForFunction(()=>document.getElementById('billingResult').textContent.length>0);
   await p.waitForFunction(()=>document.getElementById('billingStatus').textContent.includes('無料版'));
   await p.locator('#billingManage').waitFor({state:'visible'}); // a past customer can open the portal
   const [portal]=await Promise.all([context.waitForEvent('page'),p.locator('#billingManage').click()]);
   await portal.waitForLoadState('domcontentloaded');
   assert.match(portal.url(),/^https:\/\/billing\.stripe\.com\//);
   console.log('PASS carried-over canceled purchase id: free again, manage opens the Stripe customer portal');
   await portal.close();
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
