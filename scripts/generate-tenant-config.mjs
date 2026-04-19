const args = process.argv.slice(2);

const getArg = (name) => {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};

const slug = getArg('slug');
const name = getArg('name') || slug;
const domain = getArg('domain');
const supabaseUrl = getArg('supabase-url');
const publishableKey = getArg('publishable-key');
const apiBaseUrl = getArg('api-base-url') || (supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1` : '');

if (!slug || !supabaseUrl || !publishableKey) {
  console.error(
    [
      'Usage:',
      'node scripts/generate-tenant-config.mjs --slug=client-a --name="Client A" --domain=client-a.hanilink.app --supabase-url=https://xxx.supabase.co --publishable-key=sb_publishable_xxx',
    ].join('\n')
  );
  process.exit(1);
}

const tenantEntry = {
  [slug]: {
    name,
    domains: domain ? [domain] : [],
    supabaseUrl,
    supabasePublishableKey: publishableKey,
    apiBaseUrl,
  },
};

console.log(JSON.stringify(tenantEntry, null, 2));
