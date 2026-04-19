import { Building2 } from 'lucide-react';

interface TenantFieldProps {
  value: string;
  onChange: (value: string) => void;
}

const TenantField = ({ value, onChange }: TenantFieldProps) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Espace client</label>
    <div className="relative">
      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        autoCapitalize="none"
        autoCorrect="off"
        className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all dark:text-white"
        placeholder="ex: client-demo"
        value={value}
        onChange={(e) => onChange(e.target.value.toLowerCase())}
      />
    </div>
    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
      Chaque client peut pointer vers sa propre base Supabase.
    </p>
  </div>
);

export default TenantField;
