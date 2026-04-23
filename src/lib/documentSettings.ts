import { formatCurrency, formatDate } from './utils';

export type DocumentDesign = 'modern' | 'classic' | 'compact';

export interface DocumentStyleSettings {
  logoUrl: string;
  fontSize: string;
  primaryColor: string;
  documentDesign: DocumentDesign;
}

export interface PrintLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  secondaryText?: string;
}

export interface PrintableDocument {
  title: string;
  documentNumber: string;
  issueDate: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  notes?: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  taxRateLabel?: string;
  paymentMethodLabel?: string;
  items: PrintLineItem[];
}

export interface PrintableUserLegalInfo {
  shopName?: string;
  address?: string;
  ice?: string;
  if?: string;
  rc?: string;
}

export const defaultDocumentStyleSettings: DocumentStyleSettings = {
  logoUrl: '',
  fontSize: '14px',
  primaryColor: '#f97316',
  documentDesign: 'modern',
};

export function normalizeDocumentSettings(value: unknown): DocumentStyleSettings {
  if (!value || typeof value !== 'object') {
    return { ...defaultDocumentStyleSettings };
  }

  const candidate = value as Partial<DocumentStyleSettings>;
  const documentDesign: DocumentDesign =
    candidate.documentDesign === 'classic' || candidate.documentDesign === 'compact'
      ? candidate.documentDesign
      : 'modern';

  return {
    logoUrl: typeof candidate.logoUrl === 'string' ? candidate.logoUrl : defaultDocumentStyleSettings.logoUrl,
    fontSize: typeof candidate.fontSize === 'string' ? candidate.fontSize : defaultDocumentStyleSettings.fontSize,
    primaryColor:
      typeof candidate.primaryColor === 'string' ? candidate.primaryColor : defaultDocumentStyleSettings.primaryColor,
    documentDesign,
  };
}

export function getStoredDocumentSettings(): DocumentStyleSettings {
  if (typeof window === 'undefined') {
    return { ...defaultDocumentStyleSettings };
  }

  const raw = window.localStorage.getItem('invoiceSettings') ?? window.localStorage.getItem('receiptSettings');
  if (!raw) {
    return { ...defaultDocumentStyleSettings };
  }

  try {
    return normalizeDocumentSettings(JSON.parse(raw));
  } catch {
    return { ...defaultDocumentStyleSettings };
  }
}

export function saveDocumentSettings(settings: DocumentStyleSettings) {
  if (typeof window === 'undefined') return;

  const normalized = normalizeDocumentSettings(settings);
  const serialized = JSON.stringify(normalized);
  window.localStorage.setItem('invoiceSettings', serialized);
  window.localStorage.setItem('receiptSettings', serialized);
}

function buildBrandBlock(settings: DocumentStyleSettings, user: PrintableUserLegalInfo) {
  const shopName = user.shopName || 'HaniLink';

  if (settings.logoUrl) {
    return `<div class="brand-logo"><img src="${settings.logoUrl}" alt="Logo" /></div>`;
  }

  return `<div class="brand-mark" style="background:${settings.primaryColor}">${shopName}</div>`;
}

function buildLegalRows(user: PrintableUserLegalInfo) {
  return [
    user.shopName ? `<div class="meta-row"><span>Boutique</span><strong>${user.shopName}</strong></div>` : '',
    user.address ? `<div class="meta-row"><span>Adresse</span><strong>${user.address}</strong></div>` : '',
    user.ice ? `<div class="meta-row"><span>ICE</span><strong>${user.ice}</strong></div>` : '',
    user.if ? `<div class="meta-row"><span>IF</span><strong>${user.if}</strong></div>` : '',
    user.rc ? `<div class="meta-row"><span>RC</span><strong>${user.rc}</strong></div>` : '',
  ]
    .filter(Boolean)
    .join('');
}

function buildCustomerRows(doc: PrintableDocument) {
  return [
    doc.customerName ? `<div class="meta-row"><span>Client</span><strong>${doc.customerName}</strong></div>` : '',
    doc.customerPhone ? `<div class="meta-row"><span>Telephone</span><strong>${doc.customerPhone}</strong></div>` : '',
    doc.customerAddress ? `<div class="meta-row"><span>Adresse</span><strong>${doc.customerAddress}</strong></div>` : '',
    `<div class="meta-row"><span>Numero</span><strong>${doc.documentNumber}</strong></div>`,
    `<div class="meta-row"><span>Date</span><strong>${formatDate(doc.issueDate)}</strong></div>`,
    doc.paymentMethodLabel
      ? `<div class="meta-row"><span>Paiement</span><strong>${doc.paymentMethodLabel}</strong></div>`
      : '',
  ]
    .filter(Boolean)
    .join('');
}

function buildItemsRows(items: PrintLineItem[]) {
  return items
    .map(
      (item) => `
        <tr>
          <td>
            <div class="line-name">${item.description}</div>
            ${item.secondaryText ? `<div class="line-meta">${item.secondaryText}</div>` : ''}
          </td>
          <td class="qty">${item.quantity}</td>
          <td class="price">${formatCurrency(item.unitPrice)}</td>
          <td class="line-total">${formatCurrency(item.lineTotal)}</td>
        </tr>
      `
    )
    .join('');
}

function buildSummary(doc: PrintableDocument) {
  return `
    <div class="totals">
      <div><span>Total HT</span><strong>${formatCurrency(doc.subtotal)}</strong></div>
      <div><span>TVA${doc.taxRateLabel ? ` (${doc.taxRateLabel})` : ''}</span><strong>${formatCurrency(doc.taxAmount)}</strong></div>
      <div class="grand"><span>Total TTC</span><strong>${formatCurrency(doc.totalAmount)}</strong></div>
    </div>
  `;
}

function buildModernTemplate(settings: DocumentStyleSettings, user: PrintableUserLegalInfo, doc: PrintableDocument) {
  return `
    <div class="sheet modern">
      <div class="hero">
        <div class="hero-top">
          <div>${buildBrandBlock(settings, user)}</div>
          <div class="doc-title">
            <div class="eyebrow">HaniLink</div>
            <h1>${doc.title}</h1>
            <p>${doc.documentNumber}</p>
          </div>
        </div>
      </div>
      <div class="content">
        <div class="meta-grid">
          <div class="meta-card">
            <h2>Entreprise</h2>
            ${buildLegalRows(user)}
          </div>
          <div class="meta-card">
            <h2>Client</h2>
            ${buildCustomerRows(doc)}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Produit</th>
              <th class="qty">Qte</th>
              <th class="price">Prix</th>
              <th class="line-total">Total</th>
            </tr>
          </thead>
          <tbody>${buildItemsRows(doc.items)}</tbody>
        </table>
        <div class="summary">
          <div class="notes">
            <h3>Informations</h3>
            <p>${doc.notes || 'Merci pour votre confiance.'}</p>
          </div>
          ${buildSummary(doc)}
        </div>
      </div>
      <div class="footer">Document genere par HaniLink</div>
    </div>
  `;
}

function buildClassicTemplate(settings: DocumentStyleSettings, user: PrintableUserLegalInfo, doc: PrintableDocument) {
  return `
    <div class="sheet classic">
      <div class="classic-topbar" style="background:${settings.primaryColor}"></div>
      <div class="classic-body">
        <div class="classic-header">
          <div class="classic-brand">${buildBrandBlock(settings, user)}</div>
          <div class="classic-title">
            <h1>${doc.title}</h1>
            <div>${doc.documentNumber}</div>
          </div>
        </div>
        <div class="classic-panels">
          <div class="classic-panel">
            <h2>Entreprise</h2>
            ${buildLegalRows(user)}
          </div>
          <div class="classic-panel">
            <h2>Client</h2>
            ${buildCustomerRows(doc)}
          </div>
        </div>
        <table class="classic-table">
          <thead>
            <tr>
              <th>Produit</th>
              <th class="qty">Qte</th>
              <th class="price">Prix</th>
              <th class="line-total">Total</th>
            </tr>
          </thead>
          <tbody>${buildItemsRows(doc.items)}</tbody>
        </table>
        <div class="classic-footer">
          <div class="classic-notes">
            <h3>Notes</h3>
            <p>${doc.notes || 'Document commercial.'}</p>
          </div>
          ${buildSummary(doc)}
        </div>
      </div>
    </div>
  `;
}

function buildCompactTemplate(settings: DocumentStyleSettings, user: PrintableUserLegalInfo, doc: PrintableDocument) {
  return `
    <div class="sheet compact">
      <div class="compact-header">
        ${buildBrandBlock(settings, user)}
        <div class="compact-heading">
          <h1>${doc.title}</h1>
          <span>${doc.documentNumber}</span>
        </div>
      </div>
      <div class="compact-grid">
        <div><strong>Date:</strong> ${formatDate(doc.issueDate)}</div>
        <div><strong>Client:</strong> ${doc.customerName || '-'}</div>
        ${doc.paymentMethodLabel ? `<div><strong>Paiement:</strong> ${doc.paymentMethodLabel}</div>` : ''}
        ${user.shopName ? `<div><strong>Boutique:</strong> ${user.shopName}</div>` : ''}
      </div>
      <table class="compact-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th class="qty">Qte</th>
            <th class="price">Prix</th>
            <th class="line-total">Total</th>
          </tr>
        </thead>
        <tbody>${buildItemsRows(doc.items)}</tbody>
      </table>
      <div class="compact-lower">
        <div class="compact-legal">${buildLegalRows(user)}</div>
        ${buildSummary(doc)}
      </div>
    </div>
  `;
}

export function buildPrintableDocumentHtml(
  settings: DocumentStyleSettings,
  user: PrintableUserLegalInfo,
  doc: PrintableDocument
) {
  const template =
    settings.documentDesign === 'classic'
      ? buildClassicTemplate(settings, user, doc)
      : settings.documentDesign === 'compact'
        ? buildCompactTemplate(settings, user, doc)
        : buildModernTemplate(settings, user, doc);

  return `
    <html>
      <head>
        <title>${doc.title} - ${doc.documentNumber}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 28px;
            font-family: "Segoe UI", "Noto Sans", Arial, sans-serif;
            font-size: ${settings.fontSize};
            color: #111827;
            background: #f3f4f6;
          }
          .sheet {
            max-width: 920px;
            margin: 0 auto;
            background: #fff;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
          }
          .brand-logo {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 72px;
            min-width: 132px;
            padding: 12px 16px;
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.16);
            border-radius: 20px;
          }
          .brand-logo img { max-height: 64px; max-width: 180px; object-fit: contain; }
          .brand-mark {
            display: inline-flex;
            align-items: center;
            padding: 16px 20px;
            border-radius: 20px;
            font-size: 28px;
            font-weight: 800;
            color: white;
          }
          .meta-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            padding: 6px 0;
            font-size: 13px;
            border-bottom: 1px dashed #e5e7eb;
          }
          .meta-row:last-child { border-bottom: none; }
          .meta-row span { color: #6b7280; }
          .meta-row strong { text-align: right; font-weight: 700; color: #111827; }
          .line-name { font-weight: 700; color: #111827; }
          .line-meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
          table { width: 100%; border-collapse: separate; border-spacing: 0; }
          th, td { padding: 12px 14px; text-align: left; }
          .qty, .price, .line-total { text-align: right; white-space: nowrap; }
          .totals {
            padding: 20px;
            border-radius: 24px;
            background: linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
            border: 1px solid #fed7aa;
          }
          .totals div { display: flex; justify-content: space-between; gap: 16px; padding: 8px 0; }
          .totals span:first-child { color: #6b7280; }
          .totals strong { color: #111827; }
          .grand {
            margin-top: 8px;
            padding-top: 14px;
            border-top: 1px solid #fdba74;
            font-size: 18px;
            font-weight: 800;
          }
          .grand span:first-child,
          .grand strong { color: ${settings.primaryColor}; }
          .modern { border-radius: 28px; }
          .hero { padding: 28px 32px 22px; background: linear-gradient(135deg, ${settings.primaryColor} 0%, #111827 100%); color: white; }
          .hero-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
          .doc-title { text-align: right; }
          .doc-title .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: 0.18em; opacity: 0.72; margin-bottom: 8px; }
          .doc-title h1 { margin: 0; font-size: 34px; line-height: 1; font-weight: 800; }
          .doc-title p { margin: 8px 0 0; font-size: 14px; opacity: 0.84; }
          .content { padding: 28px 32px 32px; }
          .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin-bottom: 24px; }
          .meta-card { padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 20px; background: #f9fafb; }
          .meta-card h2,
          .classic-panel h2,
          .notes h3,
          .classic-notes h3 {
            margin: 0 0 14px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #6b7280;
          }
          .modern table { border: 1px solid #e5e7eb; border-radius: 22px; overflow: hidden; }
          .modern thead th { background: #111827; color: #f9fafb; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
          .modern tbody td { border-bottom: 1px solid #f1f5f9; }
          .modern tbody tr:nth-child(even) td { background: #fafafa; }
          .modern tbody tr:last-child td { border-bottom: none; }
          .summary { margin-top: 24px; display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
          .notes { padding: 20px; border-radius: 20px; background: #f9fafb; border: 1px solid #e5e7eb; }
          .notes p, .classic-notes p { margin: 0; color: #374151; line-height: 1.7; }
          .footer { padding: 0 32px 28px; font-size: 12px; color: #9ca3af; text-align: center; }
          .classic { border: 1px solid #d1d5db; }
          .classic-topbar { height: 12px; }
          .classic-body { padding: 30px 34px 34px; }
          .classic-header { display: flex; justify-content: space-between; gap: 20px; align-items: center; padding-bottom: 20px; border-bottom: 2px solid #e5e7eb; }
          .classic-title { text-align: right; }
          .classic-title h1 { margin: 0; font-size: 30px; font-family: Georgia, "Times New Roman", serif; }
          .classic-title div { margin-top: 8px; color: #6b7280; font-size: 14px; }
          .classic-panels { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px; margin: 24px 0; }
          .classic-panel { padding: 18px 20px; border: 1px solid #d1d5db; }
          .classic-table { border: 1px solid #d1d5db; }
          .classic-table thead th { background: #f8fafc; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #d1d5db; }
          .classic-table tbody td { border-bottom: 1px solid #e5e7eb; }
          .classic-table tbody tr:last-child td { border-bottom: none; }
          .classic-footer { margin-top: 24px; display: grid; grid-template-columns: 1fr 320px; gap: 20px; align-items: start; }
          .classic-notes { padding: 18px 20px; border: 1px solid #d1d5db; min-height: 100%; }
          .compact { padding: 24px 24px 30px; border-radius: 22px; }
          .compact-header { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-bottom: 20px; }
          .compact-heading { text-align: right; }
          .compact-heading h1 { margin: 0; font-size: 28px; }
          .compact-heading span { color: #6b7280; font-size: 13px; }
          .compact-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px 18px;
            padding: 16px;
            background: #f8fafc;
            border: 1px solid #e5e7eb;
            border-radius: 18px;
            margin-bottom: 20px;
            font-size: 13px;
          }
          .compact-table thead th {
            background: ${settings.primaryColor};
            color: white;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          .compact-table tbody td { border-bottom: 1px solid #e5e7eb; }
          .compact-table tbody tr:last-child td { border-bottom: none; }
          .compact-lower { margin-top: 18px; display: grid; grid-template-columns: 1fr 300px; gap: 18px; align-items: start; }
          .compact-legal { padding: 16px; border: 1px solid #e5e7eb; border-radius: 18px; background: #fff; }
          @media print {
            body { background: white; padding: 0; }
            .sheet { box-shadow: none; border-radius: 0; }
          }
        </style>
      </head>
      <body>
        ${template}
        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 400); }</script>
      </body>
    </html>
  `;
}
