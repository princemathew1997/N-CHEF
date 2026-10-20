export const importHeaders = ['Outlet','Item','Category','Unit','Quantity','Unit price'];
export const maxImportRows = 150;
export const maxImportBytes = 100000;
const key = value => String(value ?? '').trim().normalize('NFKC').toLowerCase();

// A CSV record is one Excel row, including when a quoted cell contains newlines.
export function parseCSV(text) {
  text=text.replace(/^\uFEFF/,'');
  const firstLine=text.split(/\r?\n/,1)[0];
  const delimiter=(firstLine.match(/;/g) || []).length>(firstLine.match(/,/g) || []).length?';':',';
  const rows=[],errors=[];let cells=[],cell='',quoted=false,closed=false,row=1;
  const error=message=>errors.push({row,column:'CSV',message});
  const finishCell=()=>{cells.push(cell);cell='';closed=false;};
  const finishRow=()=>{finishCell();rows.push({row,cells});cells=[];row++;};
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quoted) {
      if(ch==='"') {if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}
      else cell+=ch;
    } else if(ch===delimiter) finishCell();
    else if(ch==='\r' || ch==='\n'){if(ch==='\r' && text[i+1]==='\n')i++;finishRow();}
    else if(ch==='"'){if(cell || closed){error('Unexpected quote. Save the file as CSV UTF-8 in Excel.');cell+=ch;}else quoted=true;}
    else {if(closed && ch.trim())error('Unexpected text after a closing quote.');cell+=ch;}
  }
  if(quoted)error('Unclosed quoted cell. Save the file again as CSV UTF-8 in Excel.');
  if(cell || cells.length || closed)finishRow();
  return {rows,errors};
}

export function validateLegacyCSV(csv,state,actor) {
  const errors=[],rows=[];
  const add=(row,column,message,value='')=>errors.push({row,column,message,value:String(value)});
  if(typeof csv!=='string' || new TextEncoder().encode(csv).length>maxImportBytes)return {rows,errors:[{row:1,column:'File',message:'Choose a CSV file of at most 100 KB.'}]};
  if(csv.includes('\0'))return {rows,errors:[{row:1,column:'File',message:'Use Excel’s CSV UTF-8 format; this file contains unsupported encoding.'}]};
  const parsed=parseCSV(csv);errors.push(...parsed.errors);
  const header=parsed.rows[0];
  if(!header)return {rows,errors:[{row:1,column:'Header',message:'The file is empty. Download the CSV template first.'}]};
  const headers=header.cells.map(key),required=importHeaders.slice(0,5);
  for(const name of required)if(!headers.includes(key(name)))add(1,name,'Required column is missing. Use the downloaded template.');
  for(const [index,name] of headers.entries()) {
    if(!importHeaders.some(h=>key(h)===name))add(1,'Header','Unknown column. Use only the template columns.',header.cells[index]);
    if(headers.indexOf(name)!==index)add(1,'Header','Column appears more than once.',header.cells[index]);
  }
  const data=parsed.rows.slice(1).filter(r=>r.cells.some(c=>c.trim()));
  if(!data.length)add(2,'File','Enter at least one stock row below the header.');
  if(data.length>maxImportRows)add(1,'File',`The sheet has ${data.length} entries. Maximum ${maxImportRows} entries per upload; split it into files.`);
  const seen=new Map();
  for(const record of data) {
    const {row,cells}=record;
    if(cells.length!==headers.length)add(row,'Columns',`Expected ${headers.length} cells but found ${cells.length}. Check delimiters and quoted values.`);
    const get=name=>String(cells[headers.indexOf(key(name))] ?? '').trim();
    const outletText=get('Outlet'),itemText=get('Item'),category=get('Category'),unit=get('Unit'),quantityText=get('Quantity'),priceText=get('Unit price');
    const outlets=state.outlets.filter(o=>key(o.id)===key(outletText) || key(o.name)===key(outletText));
    const outlet=outlets.length===1?outlets[0]:null;
    if(!outlet)add(row,'Outlet',outletText?'Choose one existing, unambiguous outlet name or ID.':'Outlet is required.',outletText);
    else if(actor.role!=='admin' && !actor.assignedLocations?.includes('all') && !actor.assignedLocations?.includes(outlet.id))add(row,'Outlet','You do not have access to this outlet.',outletText);
    const items=state.items.filter(i=>key(i.name)===key(itemText));
    const item=items.length===1?items[0]:null;
    if(!item)add(row,'Item',itemText?'Choose an existing, unambiguous catalog item. Ask Admin to add missing items.':'Item is required.',itemText);
    else if(item.active===false)add(row,'Item','This catalog item is inactive.',itemText);
    for(const [field,value] of [['Category',category],['Unit',unit]]) {
      if(!value)add(row,field,field+' is required.');
      else if(!(state.operationRecords || []).some(r=>r.kind===field.toLowerCase() && key(r.name)===key(value)))add(row,field,'Not in the allowed '+field.toLowerCase()+' list. Ask Admin to add it first.',value);
      else if(item && key(item[field.toLowerCase()])!==key(value))add(row,field,`Must match this catalog item: ${item[field.toLowerCase()]}.`,value);
    }
    const quantity=Number(quantityText);
    if(!/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(quantityText) || !Number.isFinite(quantity) || quantity<=0 || quantity>1e9)add(row,'Quantity','Enter a positive number up to 1,000,000,000, without currency signs, thousands separators or formulas.',quantityText);
    let unitCostMinor=null;
    if(priceText) {
      const price=Number(priceText);
      if(!/^\d+(?:\.\d{1,2})?$/.test(priceText) || !Number.isFinite(price) || price>1e9)add(row,'Unit price','Enter a non-negative price with at most 2 decimal places, or leave blank if unknown.',priceText);
      else unitCostMinor=Math.round(price*100);
    }
    if(unitCostMinor!==null && Number.isFinite(quantity) && !Number.isSafeInteger(Math.round(quantity*unitCostMinor)))add(row,'Unit price','The total cost exceeds the supported currency range.',priceText);
    if(item && outlet) {
      const balance=state.outletStock.find(b=>b.item_id===item.id && b.outlet_id===outlet.id)?.quantity || 0;
      if(Number.isFinite(quantity) && balance+quantity>1e9)add(row,'Quantity','Resulting outlet stock would exceed 1,000,000,000.',quantityText);
      if(state.legacyStock?.some(s=>s.item_id===item.id && s.issue))add(row,'Item','Legacy stock has an unresolved reconciliation issue. Ask Admin to reconcile it first.',itemText);
      const pair=item.id+'\0'+outlet.id;
      if(seen.has(pair)) {
        const prior=seen.get(pair);
        if(!errors.some(e=>e.row===prior && e.column==='Duplicate'))add(prior,'Duplicate',`The same item and outlet also appears on row ${row}. Combine quantities into one row.`);
        add(row,'Duplicate',`The same item and outlet already appears on row ${prior}. Combine quantities into one row.`);
      } else seen.set(pair,row);
      rows.push({row,outletId:outlet.id,outletName:outlet.name,itemId:item.id,itemName:item.name,category:item.category,unit:item.unit,quantity,unitCostMinor,currentQuantity:balance,resultingQuantity:balance+quantity});
    }
  }
  return {rows,errors:errors.sort((a,b)=>a.row-b.row)};
}

// Prefix formula-like cells in downloads so opening the CSV in Excel cannot execute them.
export function csvCell(value) {
  const text=String(value ?? '');
  return '"'+(/^[\s]*[=+@-]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';
}
export const encodeCSV = rows => '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
