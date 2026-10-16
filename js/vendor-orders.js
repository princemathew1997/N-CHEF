// Supplier-only documents: this module accepts one order, never the full order collection.
(function(root) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function defaults(indent, catalog, vendors) {
    return indent.items.filter(i=>(i.revisedQty ?? i.originalQty)>0).map(line=>{
      const item=catalog.find(i=>i.id===line.itemId);
      return {...line, qty:line.revisedQty ?? line.originalQty, vendorId:vendors.find(v=>v.name===item?.vendor)?.id || '', notes:''};
    });
  }
  function documentBody(po) {
    const e=escape;
    return `<article style="font-family:Arial,sans-serif;color:#18202b;background:white;padding:24px;font-size:12px;line-height:1.5;width:690px;box-sizing:border-box">
      <h1 style="color:#18202b;font-size:25px;margin:0;border-bottom:3px solid #e6ac00;padding-bottom:12px">n.chef | Purchase Order</h1>
      <h2 style="color:#18202b;font-size:20px;margin:16px 0">To: ${e(po.vendorName)}</h2>
      <p><b>Order:</b> ${e(po.poNumber)}<br><b>Order date:</b> ${e(po.date || po.createdAt?.slice(0,10))}<br><b>Delivery outlet:</b> ${e(po.outletName)}<br><b>Expected delivery:</b> ${e(po.expectedDelivery || 'To be confirmed')}</p>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed"><thead><tr style="background:#f4e8bc"><th style="color:#18202b;background:#f4e8bc;text-align:left;width:37%;padding:9px">Ingredient</th><th style="color:#18202b;background:#f4e8bc;text-align:right;width:14%;padding:9px">Quantity</th><th style="color:#18202b;background:#f4e8bc;text-align:left;width:12%;padding:9px">Unit</th><th style="color:#18202b;background:#f4e8bc;text-align:left;padding:9px">Note</th></tr></thead><tbody>${po.items.map(i=>`<tr style="break-inside:avoid"><td style="padding:9px;border-bottom:1px solid #ddd;overflow-wrap:anywhere">${e(i.itemName)}</td><td style="padding:9px;text-align:right;border-bottom:1px solid #ddd">${e(i.qty)}</td><td style="padding:9px;border-bottom:1px solid #ddd">${e(i.unit)}</td><td style="padding:9px;border-bottom:1px solid #ddd;overflow-wrap:anywhere">${e(i.notes)}</td></tr>`).join('')}</tbody></table>
      ${po.notes?`<p><b>Delivery instructions:</b> ${e(po.notes)}</p>`:''}
      <p style="font-size:10px;color:#555;margin-top:22px">Please quote the order number when arranging delivery.</p></article>`;
  }
  const api={escape, defaults, documentBody};
  if(typeof module!=='undefined' && module.exports)module.exports=api;
  root.VendorOrders=api;
})(typeof window==='undefined'?globalThis:window);
