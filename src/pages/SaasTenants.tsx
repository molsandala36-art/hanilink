import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Database,
  Download,
  FileJson,
  Globe,
  KeyRound,
  Layers3,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { getSupabaseUrl } from '../lib/backend';
import {
  generateTenantProvisioningPayload,
  isSameSupabaseProject,
  type TenantProvisioningInput,
} from '../lib/saasProvisioning';

const STORAGE_KEY = 'hani_saas_tenant_draft';
const RUNS_STORAGE_KEY = 'hani_saas_tenant_runs';

interface SavedProvisioningRun {
  id: string;
  createdAt: string;
  draft: TenantProvisioningInput;
}

const defaultDraft: TenantProvisioningInput = {
  slug: '',
  name: '',
  ownerEmail: '',
  domain: '',
  supabaseUrl: '',
  publishableKey: '',
  projectRef: '',
  plan: 'starter',
  billingCycle: 'monthly',
  licenseEnforcement: false,
};

const cardClass =
  'rounded-3xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl';

const SaasTenants = () => {
  const [draft, setDraft] = useState<TenantProvisioningInput>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return defaultDraft;
    try {
      return { ...defaultDraft, ...JSON.parse(stored) };
    } catch {
      return defaultDraft;
    }
  });
  const [savedRuns, setSavedRuns] = useState<SavedProvisioningRun[]>(() => {
    const stored = localStorage.getItem(RUNS_STORAGE_KEY);
    if (!stored) return [];
    try {
      return JSON.parse(stored) as SavedProvisioningRun[];
    } catch {
      return [];
    }
  });
  const [copied, setCopied] = useState('');
  const currentShopSupabaseUrl = getSupabaseUrl();
  const reusesCurrentShopDatabase = isSameSupabaseProject(draft.supabaseUrl, currentShopSupabaseUrl);
  const provisioningIssue = reusesCurrentShopDatabase
    ? "Ce client pointe vers la meme base Supabase que ta boutique actuelle. Cree d'abord un nouveau projet Supabase dedie, puis colle sa nouvelle URL ici."
    : '';

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    localStorage.setItem(RUNS_STORAGE_KEY, JSON.stringify(savedRuns));
  }, [savedRuns]);

  const payload = useMemo(() => {
    if (!draft.slug || !draft.supabaseUrl || !draft.publishableKey || provisioningIssue) {
      return null;
    }

    return generateTenantProvisioningPayload(draft);
  }, [draft, provisioningIssue]);

  const updateField = <K extends keyof TenantProvisioningInput>(key: K, value: TenantProvisioningInput[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1800);
  };

  const reset = () => {
    setDraft(defaultDraft);
    localStorage.removeItem(STORAGE_KEY);
  };

  const saveRun = () => {
    setSavedRuns((current) => [
      {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        draft,
      },
      ...current.filter((run) => run.draft.slug !== draft.slug).slice(0, 11),
    ]);
    setCopied('saved');
    window.setTimeout(() => setCopied(''), 1800);
  };

  const loadRun = (run: SavedProvisioningRun) => {
    setDraft(run.draft);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const removeRun = (id: string) => {
    setSavedRuns((current) => current.filter((run) => run.id !== id));
  };

  const downloadFile = (filename: string, content: string, mimeType = 'application/json') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Layers3 className="w-8 h-8 text-orange-500" />
            SaaS Clients
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
            Ouvre un nouveau client avec sa base Supabase separee, son domaine et sa configuration dediee.
          </p>
          {currentShopSupabaseUrl ? (
            <p className="mt-2 text-sm text-orange-600 dark:text-orange-300">
              Base actuelle de ta boutique: {currentShopSupabaseUrl}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {payload && (
            <button
              onClick={saveRun}
              className="px-4 py-2 rounded-xl bg-orange-500 text-sm font-semibold text-white hover:bg-orange-600 transition-colors inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {copied === 'saved' ? 'Sauvegarde' : 'Sauvegarder'}
            </button>
          )}
          <button
            onClick={reset}
            className="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Reinitialiser
          </button>
        </div>
      </div>

      {savedRuns.length > 0 && (
        <div className={`${cardClass} p-6`}>
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Runs recents</h2>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {savedRuns.map((run) => (
              <div key={run.id} className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
                <p className="font-semibold text-gray-900 dark:text-white">{run.draft.name || run.draft.slug}</p>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{run.draft.slug}</p>
                <p className="mt-1 text-xs text-gray-400">{new Date(run.createdAt).toLocaleString()}</p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => loadRun(run)}
                    className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                  >
                    Ouvrir
                  </button>
                  <button
                    onClick={() => removeRun(run.id)}
                    className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.05fr,0.95fr]">
        <section className={`${cardClass} p-6 md:p-8`}>
          {provisioningIssue ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{provisioningIssue}</p>
              </div>
            </div>
          ) : null}
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Slug client</span>
              <input
                value={draft.slug}
                onChange={(e) => updateField('slug', e.target.value.toLowerCase().trim())}
                placeholder="client-a"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nom client</span>
              <input
                value={draft.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Client A"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email owner</span>
              <input
                value={draft.ownerEmail}
                onChange={(e) => updateField('ownerEmail', e.target.value)}
                placeholder="owner@client-a.com"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Domaine</span>
              <input
                value={draft.domain}
                onChange={(e) => updateField('domain', e.target.value.toLowerCase().trim())}
                placeholder="client-a.hanilink.app"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Supabase URL</span>
              <input
                value={draft.supabaseUrl}
                onChange={(e) => updateField('supabaseUrl', e.target.value)}
                placeholder="https://client-a.supabase.co"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
              <span className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                Utilise une nouvelle URL Supabase dediee a ce client. Ne reutilise jamais la base de ta boutique actuelle.
              </span>
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Publishable key</span>
              <input
                value={draft.publishableKey}
                onChange={(e) => updateField('publishableKey', e.target.value)}
                placeholder="sb_publishable_xxx"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Project ref</span>
              <input
                value={draft.projectRef}
                onChange={(e) => updateField('projectRef', e.target.value)}
                placeholder="abc123xyz"
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Plan</span>
              <select
                value={draft.plan}
                onChange={(e) => updateField('plan', e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              >
                <option value="starter">starter</option>
                <option value="growth">growth</option>
                <option value="enterprise">enterprise</option>
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Facturation</span>
              <select
                value={draft.billingCycle}
                onChange={(e) => updateField('billingCycle', e.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
              >
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
              </select>
            </label>
            <label className="md:col-span-2 flex items-start gap-3 rounded-2xl border border-orange-100 dark:border-orange-900/30 bg-orange-50 dark:bg-orange-950/20 p-4">
              <input
                type="checkbox"
                checked={draft.licenseEnforcement}
                onChange={(e) => updateField('licenseEnforcement', e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-orange-900 dark:text-orange-200">
                Activer le licensing pour ce client. La checklist inclura la migration et le deploiement des fonctions de licence.
              </span>
            </label>
          </div>
        </section>

        <section className="space-y-6">
          <div className={`${cardClass} p-6`}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-orange-500" />
              Resume
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Tenant</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">{draft.slug || 'non defini'}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Domaine</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white break-all">{draft.domain || 'a definir'}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Base client</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white break-all">{draft.supabaseUrl || 'a definir'}</p>
              </div>
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Licensing</p>
                <p className="mt-2 font-semibold text-gray-900 dark:text-white">
                  {draft.licenseEnforcement ? 'active' : 'desactive'}
                </p>
              </div>
            </div>
          </div>

          {payload ? (
            <>
              <OutputCard
                title="Bloc tenant"
                icon={<FileJson className="w-5 h-5 text-orange-500" />}
                value={JSON.stringify(payload.tenantConfig, null, 2)}
                copied={copied === 'tenant'}
                onCopy={() => copy(JSON.stringify(payload.tenantConfig, null, 2), 'tenant')}
                onDownload={() =>
                  downloadFile(
                    `${draft.slug || 'tenant'}-config.json`,
                    JSON.stringify(payload.tenantConfig, null, 2)
                  )
                }
              />
              <OutputCard
                title="Snippet Vercel / env"
                icon={<Globe className="w-5 h-5 text-orange-500" />}
                value={payload.envSnippet}
                copied={copied === 'env'}
                onCopy={() => copy(payload.envSnippet, 'env')}
                onDownload={() =>
                  downloadFile(`${draft.slug || 'tenant'}-env.txt`, payload.envSnippet, 'text/plain')
                }
              />
              <OutputCard
                title="SQL master SaaS"
                icon={<Database className="w-5 h-5 text-orange-500" />}
                value={payload.masterInsertSql}
                copied={copied === 'sql'}
                onCopy={() => copy(payload.masterInsertSql, 'sql')}
                onDownload={() =>
                  downloadFile(`${draft.slug || 'tenant'}-master.sql`, payload.masterInsertSql, 'text/sql')
                }
              />
              <div className={`${cardClass} p-6`}>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-orange-500" />
                  Checklist
                </h2>
                <div className="mt-4 space-y-3">
                  {payload.checklist.map((item) => (
                    <div key={item} className="flex items-start gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
                      <CheckCircle2 className="w-5 h-5 mt-0.5 text-green-500 shrink-0" />
                      <p className="text-sm text-gray-700 dark:text-gray-200">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className={`${cardClass} p-6`}>
              <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
                {provisioningIssue ||
                  "Renseigne au minimum le slug, l'URL Supabase et la publishable key pour generer le provisioning."}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className={`${cardClass} p-6`}>
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-orange-500" />
          Rappels utiles
        </h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <InfoTile
            title="Schema client"
            body="Applique supabase/templates/client-app-schema.sql dans une nouvelle base Supabase client, jamais dans la base de ta boutique."
          />
          <InfoTile
            title="Schema master"
            body="Applique supabase/templates/master-saas-schema.sql dans ta base centrale SaaS."
          />
          <InfoTile
            title="Test rapide"
            body="Teste ensuite avec ?tenant=<slug> ou via le champ Espace client sur login/register."
          />
        </div>
      </div>
    </div>
  );
};

const OutputCard = ({
  title,
  icon,
  value,
  copied,
  onCopy,
  onDownload,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  copied: boolean;
  onCopy: () => void;
  onDownload?: () => void;
}) => (
  <div className={`${cardClass} p-6`}>
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <div className="flex gap-2">
        {onDownload && (
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        )}
        <button
          onClick={onCopy}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copie' : 'Copier'}
        </button>
      </div>
    </div>
    <textarea
      readOnly
      value={value}
      className="mt-4 min-h-44 w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 px-4 py-4 font-mono text-sm text-gray-800 dark:text-gray-200 outline-none"
    />
  </div>
);

const InfoTile = ({ title, body }: { title: string; body: string }) => (
  <div className="rounded-2xl bg-gray-50 dark:bg-gray-800 p-4">
    <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{body}</p>
  </div>
);

export default SaasTenants;
