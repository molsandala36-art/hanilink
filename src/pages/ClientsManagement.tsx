import { useEffect, useMemo, useState } from 'react';
import { Building2, Phone, MapPin, Search, Users } from 'lucide-react';
import api from '../services/api';
import { formatCurrency, formatDate } from '../lib/utils';

interface BusinessDocument {
  _id: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  totalAmount: number;
  issueDate: string;
  documentType: string;
}

interface CustomerSummary {
  id: string;
  name: string;
  phone: string;
  address: string;
  documentsCount: number;
  totalAmount: number;
  lastDocumentAt: string;
  lastDocumentType: string;
}

const normalizeText = (value: string) => value.trim().toLowerCase();

const ClientsManagement = () => {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await api.get('/documents');
        setDocuments(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    void fetchDocuments();
  }, []);

  const customers = useMemo<CustomerSummary[]>(() => {
    const grouped = new Map<string, CustomerSummary>();

    documents.forEach((document) => {
      const name = String(document.customerName || '').trim();
      if (!name) return;

      const phone = String(document.customerPhone || '').trim();
      const address = String(document.customerAddress || '').trim();
      const key = `${normalizeText(name)}::${normalizeText(phone)}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          id: key,
          name,
          phone,
          address,
          documentsCount: 1,
          totalAmount: Number(document.totalAmount || 0),
          lastDocumentAt: document.issueDate,
          lastDocumentType: document.documentType || '',
        });
        return;
      }

      existing.documentsCount += 1;
      existing.totalAmount += Number(document.totalAmount || 0);
      if (new Date(document.issueDate).getTime() > new Date(existing.lastDocumentAt).getTime()) {
        existing.lastDocumentAt = document.issueDate;
        existing.lastDocumentType = document.documentType || '';
      }
      if (!existing.phone && phone) existing.phone = phone;
      if (!existing.address && address) existing.address = address;
    });

    return Array.from(grouped.values()).sort(
      (left, right) => new Date(right.lastDocumentAt).getTime() - new Date(left.lastDocumentAt).getTime()
    );
  }, [documents]);

  const filteredCustomers = useMemo(() => {
    const term = normalizeText(searchTerm);
    if (!term) return customers;

    return customers.filter((customer) =>
      [customer.name, customer.phone, customer.address, customer.lastDocumentType]
        .some((value) => normalizeText(value).includes(term))
    );
  }, [customers, searchTerm]);

  const totals = useMemo(() => ({
    customers: customers.length,
    documents: customers.reduce((sum, customer) => sum + customer.documentsCount, 0),
    revenue: customers.reduce((sum, customer) => sum + customer.totalAmount, 0),
  }), [customers]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900 dark:text-white">
            <Users className="h-8 w-8 text-orange-500" />
            Gestion des clients
          </h1>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            Vue consolidée des clients issus des devis, bons de livraison et factures.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Clients" value={String(totals.customers)} icon={<Users className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Documents" value={String(totals.documents)} icon={<Building2 className="h-5 w-5 text-orange-500" />} />
        <StatCard label="Chiffre suivi" value={formatCurrency(totals.revenue)} icon={<MapPin className="h-5 w-5 text-orange-500" />} />
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Rechercher un client, telephone ou adresse"
            className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-12 pr-4 outline-none transition focus:ring-2 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-gray-50 dark:bg-gray-800/60">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">Adresse</th>
                <th className="px-6 py-4">Documents</th>
                <th className="px-6 py-4">Montant total</th>
                <th className="px-6 py-4">Derniere activite</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Chargement des clients...
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    Aucun client trouvé pour le moment.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="align-top hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900 dark:text-white">{customer.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">{customer.lastDocumentType || 'document'}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {customer.phone ? (
                        <span className="inline-flex items-center gap-2">
                          <Phone className="h-4 w-4 text-orange-500" />
                          {customer.phone}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">{customer.address || '-'}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900 dark:text-white">{customer.documentsCount}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-orange-600 dark:text-orange-400">
                      {formatCurrency(customer.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                      {formatDate(customer.lastDocumentAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) => (
  <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      </div>
      <div className="rounded-2xl bg-orange-50 p-3 dark:bg-orange-900/20">{icon}</div>
    </div>
  </div>
);

export default ClientsManagement;
