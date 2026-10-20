import {encodeCSV,importHeaders,maxImportRows,maxImportBytes} from '../shared/legacy-import.mjs';

const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const download=(name,rows)=>{
  const url=URL.createObjectURL(new Blob([encodeCSV(rows)],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.renderLegacyImport=content=>{
  let csv='',validation=null,operationId=crypto.randomUUID(),errors=[];
  content.innerHTML=`<p>Upload opening stock for existing catalog items. Quantities are <strong>added to current outlet stock</strong>; existing stock is not replaced. This does not move the unassigned central legacy balance. Admin handles that separately through Assign Legacy Stock.</p>
    <p>Download the CSV template, enter your data in Excel and save as <strong>CSV UTF-8 (.csv)</strong>. Comma and semicolon separators are supported. Upload one complete sheet per file, up to ${maxImportRows} stock rows / ${maxImportBytes/1000} KB. Native .xlsx/.xls files must first be saved as CSV.</p>
    <p>Columns: <strong>${importHeaders.join(', ')}</strong>. Unit price is optional (INR, up to two decimal places). It fills missing stock valuation; an existing latest purchase cost is preserved. Category and unit must be on the allowed lists and match the selected item. Combine repeated item/outlet entries into one row.</p>
    <div class="operations-links"><button type="button" class="btn btn-outline" id="legacyTemplate">Download CSV template</button><button type="button" class="btn btn-outline" id="legacyAllowed">Download allowed values</button></div>
    <details><summary>Allowed categories, units and outlets</summary><div id="legacyLists"></div></details>
    <form class="inventory-form" id="legacyUploadForm"><label>Excel-saved CSV<input id="legacyFile" type="file" accept=".csv,text/csv" required></label><button class="btn btn-primary" id="legacyValidate">Validate entire file</button></form>
    <p id="legacyStatus" role="status" aria-live="polite"></p><div id="legacyResults"></div><button type="button" class="btn btn-outline hidden" id="legacyErrors">Download error report</button><button type="button" class="btn btn-primary hidden" id="legacyConfirm">Import all validated rows</button>`;
  const button=content.querySelector('#legacyConfirm'),status=content.querySelector('#legacyStatus'),results=content.querySelector('#legacyResults'),fileInput=content.querySelector('#legacyFile');
  const refs=()=>committedState.operationRecords || [];
  content.querySelector('#legacyLists').innerHTML=['category','unit'].map(kind=>`<p><strong>${kind==='category'?'Categories':'Units'}:</strong> ${refs().filter(r=>r.kind===kind).map(r=>escapeHTML(r.name)).join(', ')}</p>`).join('')+`<p><strong>Outlets:</strong> ${outletsData.map(o=>escapeHTML(o.name)+' ('+escapeHTML(o.id)+')').join(', ')}</p><p>Download allowed values for the item names and their matching categories and units. Admin must create any missing catalog choices before import.</p>`;
  content.querySelector('#legacyTemplate').onclick=()=>download('nchef-legacy-stock-template.csv',[importHeaders]);
  content.querySelector('#legacyAllowed').onclick=()=>download('nchef-stock-allowed-values.csv',[
    ['Type','Name','Category','Unit'],
    ...masterItemsData.filter(i=>i.active!==false).map(i=>['Item',i.name,i.category,i.unit]),
    ...refs().filter(r=>['category','unit'].includes(r.kind)).map(r=>[r.kind,r.name,'','']),
    ...outletsData.map(o=>['Outlet',o.name,'ID: '+o.id,''])
  ]);
  const table=(headers,rows)=>`<div class="table-container"><table><thead><tr>${headers.map(h=>`<th>${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${escapeHTML(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const showErrors=(list,message)=>{
    validation=null;errors=list;button.classList.add('hidden');
    content.querySelector('#legacyErrors').classList.toggle('hidden',!list.length);
    status.textContent=message || `${list.length} errors across ${new Set(list.map(e=>e.row)).size} Excel rows. Nothing imported. Correct all errors, save the CSV and upload it again.`;
    results.innerHTML=table(['Excel row','Column','Entered value','Problem'],list.map(e=>[e.row,e.column,e.value || '',e.message]));
  };
  content.querySelector('#legacyErrors').onclick=()=>download('nchef-legacy-stock-errors.csv',[['Excel row','Column','Entered value','Problem'],...errors.map(e=>[e.row,e.column,e.value || '',e.message])]);
  fileInput.onchange=()=>{validation=null;csv='';operationId=crypto.randomUUID();results.replaceChildren();button.classList.add('hidden');content.querySelector('#legacyErrors').classList.add('hidden');status.textContent='File selected. Validate it before importing.';};
  const busy=value=>{content.querySelectorAll('button,input').forEach(el=>el.disabled=value);};
  content.querySelector('form').onsubmit=async event=>{
    event.preventDefault();validation=null;button.classList.add('hidden');
    const file=fileInput.files[0];if(!file)return;
    if(!/\.csv$/i.test(file.name)){showErrors([{row:1,column:'File',message:'Save your Excel sheet as CSV UTF-8 (.csv) before uploading.'}]);return;}
    if(file.size>maxImportBytes){showErrors([{row:1,column:'File',message:'File exceeds 100 KB. Split it into smaller CSV files.'}]);return;}
    busy(true);status.textContent='Checking every row…';
    try {
      csv=await file.text();const result=await apiRequest('stock/legacy-import/validate','POST',{csv});validation=result;
      content.querySelector('#legacyErrors').classList.add('hidden');errors=[];
      status.textContent=`All ${result.rows.length} rows passed validation. Review the complete preview, then import. No stock has been changed yet.`;
      results.innerHTML=table(['Excel row','Outlet','Item','Category','Unit','Quantity to add','Current stock','Stock after import','Entered unit price (INR)'],result.rows.map(r=>[r.row,r.outletName,r.itemName,r.category,r.unit,r.quantity,r.currentQuantity,r.resultingQuantity,r.unitCostMinor==null?'Unknown':(r.unitCostMinor/100).toFixed(2)]));
      button.classList.remove('hidden');
    }catch(error){showErrors(error.details || [{row:1,column:'File',message:error.message}]);}
    finally{busy(false);}
  };
  button.onclick=async()=>{
    if(!validation)return;
    if(databaseWritePending || pendingChanges().length){status.textContent='Finish your other pending changes before importing.';return;}
    busy(true);databaseWritePending=true;document.body.classList.add('database-saving');
    try {
      const count=validation.rows.length;
      const state=await apiRequest('stock/legacy-import','POST',{csv,revision:validation.revision,operationId});
      applyServerState(state);window.onLiveSyncReceived?.();validation=null;button.classList.add('hidden');
      status.textContent=`Imported all ${count} rows successfully. Opening stock movements are recorded in Stock History.`;
      fileInput.value='';window.showToast?.('Legacy stock imported successfully','success');
    }catch(error){
      if(error.status){showErrors(error.details || [{row:1,column:'File',message:error.message}]);}
      else status.textContent='Connection interrupted. Use Import again to retry safely; the same import will not be applied twice.';
    }finally{databaseWritePending=false;document.body.classList.remove('database-saving');busy(false);}
  };
};
