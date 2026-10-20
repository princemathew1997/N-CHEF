import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateRequestDate} from '../worker/model.mjs';
const now=new Date('2026-10-20T06:00:00Z');
test('request dates default to the IST calendar and permit exactly the previous three days',()=>{
 assert.equal(validateRequestDate('2026-10-20','',now).backdated,false);
 for(const date of ['2026-10-19','2026-10-18','2026-10-17'])assert.equal(validateRequestDate(date,'Late entry',now).backdated,true);
 for(const date of ['2026-10-16','2026-10-21','2026-02-30','bad',''])assert.throws(()=>validateRequestDate(date,'Reason',now));
});
test('backdating requires meaningful justification but current-day requests do not',()=>{
 for(const reason of [undefined,'','   '])assert.throws(()=>validateRequestDate('2026-10-19',reason,now));
 assert.doesNotThrow(()=>validateRequestDate('2026-10-20','',now));
 assert.throws(()=>validateRequestDate('2026-10-19','x'.repeat(501),now));
});
test('request-date limits follow IST midnight and month boundaries',()=>{
 assert.equal(validateRequestDate('2026-11-01','',new Date('2026-10-31T18:30:00Z')).backdated,false);
 assert.equal(validateRequestDate('2026-10-29','Delayed entry',new Date('2026-10-31T18:30:00Z')).backdated,true);
 assert.throws(()=>validateRequestDate('2026-10-28','Delayed entry',new Date('2026-10-31T18:30:00Z')));
});
