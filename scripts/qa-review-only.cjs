// Runs the additional review flow against an already seeded disposable QA server.
const {createRequire}=require('node:module');
const {resolve}=require('node:path');
const {chromium}=createRequire(resolve(process.env.NCHEF_PLAYWRIGHT_ROOT,'package.json'))('playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'});try{await require('./qa-review-flow.cjs')(browser,process.env.NCHEF_QA_URL || 'http://127.0.0.1:8889');console.log('Review flow browser QA passed.');}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
