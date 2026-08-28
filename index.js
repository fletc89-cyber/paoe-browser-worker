import chromium from '@sparticuz/chromium';
import { chromium as playwright } from 'playwright-core';
const TOKEN=process.env.PAOE_BROWSER_TOKEN||'';
const auth=req=>!TOKEN||(req.headers.authorization||'')===`Bearer ${TOKEN}`;
export default async function handler(req,res){
 if(req.url==='/health'||req.url==='/api/health')return res.status(200).json({ok:true,service:'paoe-browser-worker'});
 if(!auth(req))return res.status(401).json({ok:false,error:'unauthorized'});
 if(req.method!=='POST')return res.status(405).json({ok:false,error:'POST required'});
 const {action,url,selector,value,storageState}=req.body||{};let browser;
 try{
  browser=await playwright.launch({args:chromium.args,executablePath:await chromium.executablePath(),headless:true});
  const context=await browser.newContext(storageState?{storageState}:{});
  const page=await context.newPage();
  if(url)await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
  let result;
  if(action==='open')result={title:await page.title(),url:page.url()};
  else if(action==='snapshot')result={title:await page.title(),url:page.url(),text:(await page.locator('body').innerText()).slice(0,12000)};
  else if(action==='click'){await page.locator(selector).click();await page.waitForLoadState('domcontentloaded').catch(()=>{});result={url:page.url(),title:await page.title()};}
  else if(action==='fill'){await page.locator(selector).fill(value??'');result={filled:true};}
  else if(action==='submit'){await page.locator(selector||'form').evaluate(el=>el.requestSubmit?el.requestSubmit():el.submit());await page.waitForLoadState('domcontentloaded').catch(()=>{});result={url:page.url(),title:await page.title()};}
  else if(action==='extract'){const loc=page.locator(selector||'body');result={text:await loc.innerText().catch(()=>null),value:await loc.inputValue().catch(()=>null)};}
  else if(action==='screenshot')result={pngBase64:(await page.screenshot({fullPage:true})).toString('base64')};
  else if(action==='session/save')result={saved:true};
  else return res.status(400).json({ok:false,error:'unknown action'});
  const nextState=await context.storageState();
  return res.status(200).json({ok:true,result,storageState:nextState});
 }catch(e){return res.status(500).json({ok:false,error:e?.message||String(e)});}
 finally{if(browser)await browser.close().catch(()=>{});}
}