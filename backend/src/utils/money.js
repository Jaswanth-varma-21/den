// All money is integer minor units (paise). Never use floats for totals.
export const unit=(priceMinor,discountBp)=>Math.round(priceMinor*(10000-discountBp)/10000);
export const totals=(lines,taxBp)=>{const subtotalMinor=lines.reduce((s,l)=>s+l.unitMinor*l.quantity,0);const taxMinor=Math.round(subtotalMinor*taxBp/10000);return {subtotalMinor,taxMinor,totalMinor:subtotalMinor+taxMinor,taxBp}};
