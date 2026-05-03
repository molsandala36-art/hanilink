import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, FileUp, Loader2, ReceiptText, RotateCcw } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { Language, translations } from '../lib/translations';

type DocumentType = 'quote' | 'delivery_note' | 'invoice' | 'credit_note' | 'purchase_note' | 'transfer_note';

interface FiscalDocument {
  _id: string;
  documentType: DocumentType;
  documentNumber: string;
  customerName: string;
  customerIce?: string;
  customerIf?: string;
  customerRc?: string;
  issueDate: string;
  status: 'draft' | 'sent' | 'validated';
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod?: string;
  paymentReference?: string;
  validatedAt?: string | null;
}

interface SalesReturn {
  _id: string;
  saleId: string;
  totalAmount: number;
  reason?: string;
  refundMethod?: string;
  createdAt: string;
}

const DOCUMENT_TYPES: DocumentType[] = ['quote', 'delivery_note', 'invoice', 'credit_note', 'purchase_note', 'transfer_note'];
const SALES_TYPES: DocumentType[] = ['invoice', 'credit_note', 'delivery_note', 'quote'];
const PURCHASE_TYPES: DocumentType[] = ['purchase_note'];

const csvEscape = (value: unknown) => {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
};

const FiscalJournal = () => {
  const [documents, setDocuments] = useState<FiscalDocument[]>([]);
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [language] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  const t = translations[language];

  useEffect(() => {
    const load = async () => {
      try {
        const [documentResults, returnsResult] = await Promise.all([
          Promise.all(DOCUMENT_TYPES.map((type) => api.get('/documents', { params: { type } }))),
          api.get('/returns'),
        ]);

        const mergedDocuments = documentResults.flatMap((result) => result.data || []);
        setDocuments(mergedDocuments);
        setReturns(Array.isArray(returnsResult.data) ? returnsResult.data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    documents.forEach((document) => {
      years.add(String(new Date(document.issueDate || document.validatedAt || Date.now()).getFullYear()));
    });
    returns.forEach((entry) => {
      years.add(String(new Date(entry.createdAt || Date.now()).getFullYear()));
    });
    return Array.from(years).sort((left, right) => Number(right) - Number(left));
  }, [documents, returns]);

  const availableMonths = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1).padStart(2, '0'),
        label: new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : 'fr-MA', { month: 'long' }).format(
          new Date(2026, index, 1)
        ),
      })),
    [language]
  );

  const matchesPeriod = (dateValue?: string | null) => {
    const date = new Date(dateValue || Date.now());
    const year = String(date.getFullYear());
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const yearMatches = selectedYear === 'all' || selectedYear === year;
    const monthMatches = selectedMonth === 'all' || selectedMonth === month;

    return yearMatches && monthMatches;
  };

  const validatedDocuments = useMemo(
    () => documents.filter((document) => document.status === 'validated' && matchesPeriod(document.validatedAt || document.issueDate)),
    [documents, selectedYear, selectedMonth]
  );

  const vatSalesDocuments = useMemo(
    () => validatedDocuments.filter((document) => SALES_TYPES.includes(document.documentType)),
    [validatedDocuments]
  );

  const vatPurchaseDocuments = useMemo(
    () => validatedDocuments.filter((document) => PURCHASE_TYPES.includes(document.documentType)),
    [validatedDocuments]
  );

  const totalVatSales = useMemo(
    () => vatSalesDocuments.reduce((sum, document) => sum + Number(document.taxAmount || 0), 0),
    [vatSalesDocuments]
  );

  const totalVatPurchases = useMemo(
    () => vatPurchaseDocuments.reduce((sum, document) => sum + Number(document.taxAmount || 0), 0),
    [vatPurchaseDocuments]
  );

  const totalReturns = useMemo(
    () =>
      returns
        .filter((entry) => matchesPeriod(entry.createdAt))
        .reduce((sum, entry) => sum + Number(entry.totalAmount || 0), 0),
    [returns, selectedYear, selectedMonth]
  );

  const filteredReturns = useMemo(
    () => returns.filter((entry) => matchesPeriod(entry.createdAt)),
    [returns, selectedYear, selectedMonth]
  );

  const fiscalAlerts = useMemo(() => {
    return validatedDocuments.filter((document) => {
      const requiresCustomerTaxIds = document.documentType === 'invoice' || document.documentType === 'credit_note';
      const missingCustomerTaxIds =
        requiresCustomerTaxIds && (!document.customerIce || !document.customerIf || !document.customerRc);
      const missingPaymentTrace =
        document.documentType === 'invoice' && (!document.paymentMethod || !document.paymentReference);

      return missingCustomerTaxIds || missingPaymentTrace;
    });
  }, [validatedDocuments]);

  const latestValidatedDocuments = useMemo(
    () =>
      [...validatedDocuments]
        .sort(
          (left, right) =>
            new Date(right.validatedAt || right.issueDate || 0).getTime() -
            new Date(left.validatedAt || left.issueDate || 0).getTime()
        )
        .slice(0, 10),
    [validatedDocuments]
  );

  const exportMonthlyFiscalSummary = () => {
    const periodLabel = `${selectedYear === 'all' ? 'all-years' : selectedYear}-${selectedMonth === 'all' ? 'all-months' : selectedMonth}`;
    const headers = ['section', 'metric', 'value'];
    const rows = [
      ['sales', 'validated_documents', vatSalesDocuments.length],
      ['sales', 'subtotal_ht', vatSalesDocuments.reduce((sum, document) => sum + Number(document.subtotal || 0), 0).toFixed(2)],
      ['sales', 'tax_amount', totalVatSales.toFixed(2)],
      ['sales', 'total_ttc', vatSalesDocuments.reduce((sum, document) => sum + Number(document.totalAmount || 0), 0).toFixed(2)],
      ['purchases', 'validated_documents', vatPurchaseDocuments.length],
      ['purchases', 'subtotal_ht', vatPurchaseDocuments.reduce((sum, document) => sum + Number(document.subtotal || 0), 0).toFixed(2)],
      ['purchases', 'tax_amount', totalVatPurchases.toFixed(2)],
      ['purchases', 'total_ttc', vatPurchaseDocuments.reduce((sum, document) => sum + Number(document.totalAmount || 0), 0).toFixed(2)],
      ['returns', 'entries', filteredReturns.length],
      ['returns', 'total_amount', totalReturns.toFixed(2)],
      ['compliance', 'fiscal_alerts', fiscalAlerts.length],
    ];

    const csvContent = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hani-fiscal-summary-${periodLabel}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <ReceiptText className="h-10 w-10 text-orange-500" />
            {t.fiscal_journal}
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {language === 'ar'
              ? 'رؤية مركزية للوثائق المعتمدة والضريبة المرتبطة بها والتنبيهات المحاسبية.'
              : 'Vue centralisee des documents valides, de la TVA associee et des alertes comptables.'}
          </p>
        </div>
        <button
          onClick={exportMonthlyFiscalSummary}
          className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 font-bold text-gray-700 shadow-sm transition-all dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          <FileUp className="h-5 w-5" />
          {language === 'ar' ? 'تصدير الملخص المحاسبي' : 'Exporter le resume comptable'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            {language === 'ar' ? 'السنة' : 'Annee'}
          </label>
          <select
            value={selectedYear}
            onChange={(event) => setSelectedYear(event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">{language === 'ar' ? 'كل السنوات' : 'Toutes les annees'}</option>
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <label className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            {language === 'ar' ? 'الشهر' : 'Mois'}
          </label>
          <select
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          >
            <option value="all">{language === 'ar' ? 'كل الشهور' : 'Tous les mois'}</option>
            {availableMonths.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-2 block text-sm font-medium text-gray-600 dark:text-gray-300">
            {language === 'ar' ? 'Périmètre actif' : 'Perimetre actif'}
          </div>
          <div className="rounded-2xl bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {selectedYear === 'all' ? (language === 'ar' ? 'Toutes les annees' : 'Toutes les annees') : selectedYear}
            {' • '}
            {selectedMonth === 'all'
              ? language === 'ar'
                ? 'Tous les mois'
                : 'Tous les mois'
              : availableMonths.find((month) => month.value === selectedMonth)?.label || selectedMonth}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'TVA ventes' : 'TVA ventes'}</div>
          <div className="mt-2 text-2xl font-bold text-orange-600">{formatCurrency(totalVatSales)}</div>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'TVA achats' : 'TVA achats'}</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totalVatPurchases)}</div>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'Retours validés' : 'Retours valides'}</div>
          <div className="mt-2 text-2xl font-bold text-violet-600">{formatCurrency(totalReturns)}</div>
        </div>
        <div className="rounded-3xl border border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="text-sm text-gray-500 dark:text-gray-400">{language === 'ar' ? 'Alertes fiscales' : 'Alertes fiscales'}</div>
          <div className="mt-2 text-2xl font-bold text-red-600">{fiscalAlerts.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-bold text-gray-900 dark:text-white">
            {language === 'ar' ? 'Dernières validations' : 'Dernieres validations'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="pb-3">{language === 'ar' ? 'نوع' : 'Type'}</th>
                  <th className="pb-3">N°</th>
                  <th className="pb-3">{t.customer}</th>
                  <th className="pb-3">{t.total_tva}</th>
                  <th className="pb-3">{language === 'ar' ? 'اعتمد في' : 'Valide le'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {latestValidatedDocuments.map((document) => (
                  <tr key={document._id}>
                    <td className="py-3 font-medium text-gray-700 dark:text-gray-300">{t[document.documentType as keyof typeof t] as string}</td>
                    <td className="py-3 text-gray-700 dark:text-gray-300">{document.documentNumber}</td>
                    <td className="py-3 text-gray-700 dark:text-gray-300">{document.customerName}</td>
                    <td className="py-3 font-semibold text-orange-600">{formatCurrency(document.taxAmount)}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">
                      {document.validatedAt ? formatDate(document.validatedAt) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            {language === 'ar' ? 'Alertes de conformité' : 'Alertes de conformite'}
          </h2>
          <div className="space-y-3">
            {fiscalAlerts.length === 0 ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/10 dark:text-emerald-300">
                {language === 'ar'
                  ? 'لا توجد تنبيهات حرجة حالياً على الوثائق المعتمدة.'
                  : 'Aucune alerte critique actuellement sur les documents valides.'}
              </div>
            ) : (
              fiscalAlerts.map((document) => {
                const issues = [
                  !document.customerIce ? 'ICE client' : null,
                  !document.customerIf ? 'IF client' : null,
                  !document.customerRc ? 'RC client' : null,
                  document.documentType === 'invoice' && !document.paymentMethod ? 'mode de paiement' : null,
                  document.documentType === 'invoice' && !document.paymentReference ? 'reference de paiement' : null,
                ].filter(Boolean);

                return (
                  <div
                    key={document._id}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300"
                  >
                    <div className="font-bold">{document.documentNumber}</div>
                    <div className="mt-1">
                      {language === 'ar' ? 'حقول ناقصة:' : 'Champs manquants :'} {issues.join(', ')}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-3xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <FileText className="h-5 w-5 text-orange-500" />
            {language === 'ar' ? 'Synthèse ventes fiscales' : 'Synthese ventes fiscales'}
          </h2>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between"><span>{language === 'ar' ? 'Documents ventes validés' : 'Documents ventes valides'}</span><strong>{vatSalesDocuments.length}</strong></div>
            <div className="flex justify-between"><span>{language === 'ar' ? 'Base HT ventes' : 'Base HT ventes'}</span><strong>{formatCurrency(vatSalesDocuments.reduce((sum, document) => sum + Number(document.subtotal || 0), 0))}</strong></div>
            <div className="flex justify-between"><span>{language === 'ar' ? 'TVA ventes' : 'TVA ventes'}</span><strong>{formatCurrency(totalVatSales)}</strong></div>
            <div className="flex justify-between"><span>{language === 'ar' ? 'TTC ventes' : 'TTC ventes'}</span><strong>{formatCurrency(vatSalesDocuments.reduce((sum, document) => sum + Number(document.totalAmount || 0), 0))}</strong></div>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <RotateCcw className="h-5 w-5 text-violet-500" />
            {language === 'ar' ? 'Synthèse achats / retours' : 'Synthese achats / retours'}
          </h2>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex justify-between"><span>{language === 'ar' ? 'Documents achats validés' : 'Documents achats valides'}</span><strong>{vatPurchaseDocuments.length}</strong></div>
            <div className="flex justify-between"><span>{language === 'ar' ? 'Base HT achats' : 'Base HT achats'}</span><strong>{formatCurrency(vatPurchaseDocuments.reduce((sum, document) => sum + Number(document.subtotal || 0), 0))}</strong></div>
            <div className="flex justify-between"><span>{language === 'ar' ? 'TVA achats' : 'TVA achats'}</span><strong>{formatCurrency(totalVatPurchases)}</strong></div>
            <div className="flex justify-between"><span>{language === 'ar' ? 'Montant retours' : 'Montant retours'}</span><strong>{formatCurrency(totalReturns)}</strong></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FiscalJournal;
