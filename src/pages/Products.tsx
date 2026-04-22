import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  AlertCircle,
  Loader2,
  X,
  Check,
  Upload,
  FileText,
  CheckCircle2,
  ScanLine
} from 'lucide-react';
import Fuse from 'fuse.js';
import Papa from 'papaparse';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import api from '../services/api';
import { formatCurrency, cn, getDefaultVatRate } from '../lib/utils';
import { translations, Language } from '../lib/translations';
import BarcodeScannerModal from '../components/BarcodeScannerModal';

interface Product {
  _id: string;
  name: string;
  price: number;
  purchasePrice: number;
  stock: number;
  category: string;
  tvaRate: number;
  supplierTva: number;
  barcode?: string;
  place: string;
  photoUrl: string;
  supplierId?: string;
}

interface SupplierOption {
  _id: string;
  name: string;
}

const LOW_STOCK_THRESHOLD = 10;

const createDefaultFormData = () => {
  const defaultVatRate = getDefaultVatRate();

  return {
    name: '',
    price: '',
    purchasePrice: '',
    stock: '',
    category: 'GÃ©nÃ©ral',
    tvaRate: defaultVatRate,
    supplierTva: defaultVatRate,
    barcode: '',
    place: '',
    photoUrl: '',
    supplierId: ''
  };
};

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockFilter, setStockFilter] = useState('all');
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(createDefaultFormData);
  
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [language, setLanguage] = useState<Language>(() => (localStorage.getItem('language') as Language) || 'fr');

  const [crop, setCrop] = useState<Crop>();
  const [imgSrc, setImgSrc] = useState('');
  const imgRef = useRef<HTMLImageElement>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const t = translations[language];

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined);
      const reader = new FileReader();
      reader.addEventListener('load', () =>
        setImgSrc(reader.result?.toString() || ''),
      );
      reader.readAsDataURL(e.target.files[0]);
      setShowCropModal(true);
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        1,
        width,
        height,
      ),
      width,
      height,
    ));
  }

  async function handleCropComplete() {
    if (imgRef.current && crop) {
      const canvas = document.createElement('canvas');
      const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
      const scaleY = imgRef.current.naturalHeight / imgRef.current.height;
      
      const pixelWidth = crop.width * scaleX;
      const pixelHeight = crop.height * scaleY;
      
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        ctx.drawImage(
          imgRef.current,
          crop.x * scaleX,
          crop.y * scaleY,
          pixelWidth,
          pixelHeight,
          0,
          0,
          pixelWidth,
          pixelHeight,
        );
        
        const base64Image = canvas.toDataURL('image/jpeg', 0.8);
        setFormData({ ...formData, photoUrl: base64Image });
        setShowCropModal(false);
      }
    }
  }

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
    const handleLangChange = () => {
      setLanguage((localStorage.getItem('language') as Language) || 'fr');
    };
    window.addEventListener('storage', handleLangChange);
    const interval = setInterval(handleLangChange, 1000);
    return () => {
      window.removeEventListener('storage', handleLangChange);
      clearInterval(interval);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await api.get('/products');
      setProducts(res.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError(language === 'ar' ? 'تعذر تحميل المنتجات' : 'Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/suppliers');
      setSuppliers(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fuse = useMemo(() => new Fuse(products, {
    keys: ['name', 'category', 'barcode'],
    threshold: 0.3,
  }), [products]);

  const categories = useMemo(() => {
    const cats = new Set(
      products
        .map((product) => product.category?.trim())
        .filter(Boolean)
    );
    return ['all', ...Array.from(cats).sort((a, b) => a!.localeCompare(b!))];
  }, [products]);

  const supplierMap = useMemo(() => {
    return new Map(suppliers.map((supplier) => [supplier._id, supplier.name]));
  }, [suppliers]);

  const supplierOptions = useMemo(() => {
    const usedSupplierIds = new Set(
      products
        .map((product) => product.supplierId)
        .filter(Boolean)
    );

    return suppliers
      .filter((supplier) => usedSupplierIds.has(supplier._id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [products, suppliers]);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (searchTerm) {
      result = fuse.search(searchTerm).map(r => r.item);
    }

    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    if (selectedSupplier !== 'all') {
      result = result.filter((product) => product.supplierId === selectedSupplier);
    }

    if (stockFilter !== 'all') {
      result = result.filter(p => {
        if (stockFilter === 'low') return p.stock > 0 && p.stock < LOW_STOCK_THRESHOLD;
        if (stockFilter === 'out') return p.stock <= 0;
        if (stockFilter === 'in') return p.stock >= LOW_STOCK_THRESHOLD;
        return true;
      });
    }

    return result;
  }, [fuse, searchTerm, products, selectedCategory, selectedSupplier, stockFilter]);

  const hasActiveFilters = searchTerm || selectedCategory !== 'all' || selectedSupplier !== 'all' || stockFilter !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedSupplier('all');
    setStockFilter('all');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let savedProduct: Product;
      if (editingProduct) {
        const res = await api.put(`/products/${editingProduct._id}`, formData);
        savedProduct = res.data;
        setProducts((current) =>
          current.map((product) => (product._id === editingProduct._id ? savedProduct : product))
        );
      } else {
        const res = await api.post('/products', formData);
        savedProduct = res.data;
        setProducts((current) => [savedProduct, ...current]);
      }
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData(createDefaultFormData());
      setError('');
      await fetchProducts();
    } catch (err) {
      console.error(err);
      setError(language === 'ar' ? 'تعذر حفظ المنتج' : 'Impossible d’enregistrer le produit');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.confirm_delete_product)) {
      try {
        await api.delete(`/products/${id}`);
        fetchProducts();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data;
        const errors: string[] = [];
        
        const validatedData = data.map((row: any, index) => {
          const name = row.name || row.Name || row.NOM || row.nom;
          const price = parseFloat(row.price || row.Price || row.PRIX || row.prix);
          const purchasePrice = parseFloat(row.purchasePrice || row.initial_price || row.prix_achat) || 0;
          const stock = parseInt(row.stock || row.Stock || row.STOCK || row.quantité || row.quantite);
          const category = row.category || row.Category || row.CATEGORIE || row.categorie || 'Général';
          const defaultVatRate = Number(getDefaultVatRate());
          const tvaRate = parseFloat(row.tvaRate || row.TVA || row.tva) || defaultVatRate;
          const supplierTva = parseFloat(row.supplierTva || row.tva_fournisseur) || defaultVatRate;
          const barcode = String(row.barcode || row.Barcode || row.codebarre || row.code_barres || '').trim();
          const place = row.place || row.emplacement || '';
          const photoUrl = row.photoUrl || row.photo || '';

          if (!name) errors.push(`Ligne ${index + 1}: Nom manquant`);
          if (isNaN(price)) errors.push(`Ligne ${index + 1}: Prix invalide`);
          if (isNaN(stock)) errors.push(`Ligne ${index + 1}: Stock invalide`);

          return { name, price, purchasePrice, stock, category, tvaRate, supplierTva, barcode, place, photoUrl };
        });

        setImportData(validatedData);
        setImportErrors(errors);
      },
      error: (err) => {
        setImportErrors([`Erreur de lecture du fichier: ${err.message}`]);
      }
    });
  };

  const handleBulkImport = async () => {
    if (importErrors.length > 0 || importData.length === 0) return;
    
    setIsImporting(true);
    try {
      await api.post('/products/bulk', importData);
      setIsImportModalOpen(false);
      setImportData([]);
      setImportErrors([]);
      fetchProducts();
    } catch (err) {
      console.error(err);
      setImportErrors([language === 'ar' ? 'فشل الاستيراد' : 'Échec de l\'importation']);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t.products}</h1>
          <p className="text-gray-500 dark:text-gray-400">{language === 'ar' ? 'إدارة المخزون والمنتجات' : 'Gérez votre stock et vos prix'}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setImportData([]);
              setImportErrors([]);
              setIsImportModalOpen(true);
            }}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <Upload className="w-5 h-5" />
            {t.import_csv}
          </button>
          <button 
            onClick={() => {
              setEditingProduct(null);
              setFormData(createDefaultFormData());
              setIsModalOpen(true);
            }}
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors shadow-lg shadow-orange-200"
          >
            <Plus className="w-5 h-5" />
            {t.add_product}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {error && (
          <div className="mx-4 mt-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl border border-red-100 dark:border-red-800">
            {error}
          </div>
        )}
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 space-y-4">
          <div className="relative w-full">
            <Search className={cn("absolute top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5", language === 'ar' ? "right-3" : "left-3")} />
            <input 
              type="text" 
              placeholder={t.search_product}
              className={cn(
                "w-full py-2 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-orange-500 outline-none dark:text-white",
                language === 'ar' ? "pr-10 pl-4" : "pl-10 pr-4"
              )}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t.all_categories}</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{language === 'ar' ? 'جميع الموردين' : 'Tous les fournisseurs'}</option>
              {supplierOptions.map((supplier) => (
                <option key={supplier._id} value={supplier._id}>{supplier.name}</option>
              ))}
            </select>
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="flex-1 min-w-0 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm outline-none dark:text-white focus:ring-2 focus:ring-orange-500"
            >
              <option value="all">{t.stock_status}</option>
              <option value="in">{t.in_stock}</option>
              <option value="low">{t.low_stock_filter}</option>
              <option value="out">{t.out_of_stock}</option>
            </select>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {language === 'ar' ? 'إعادة تعيين' : 'Réinitialiser'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{filteredProducts.length} / {products.length} {language === 'ar' ? 'منتج' : 'produits'}</span>
            {selectedCategory !== 'all' && (
              <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {t.category}: {selectedCategory}
              </span>
            )}
            {selectedSupplier !== 'all' && (
              <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {language === 'ar' ? 'المورد' : 'Fournisseur'}: {supplierMap.get(selectedSupplier) || selectedSupplier}
              </span>
            )}
            {stockFilter !== 'all' && (
              <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                {t.stock_status}: {stockFilter === 'in' ? t.in_stock : stockFilter === 'low' ? t.low_stock_filter : t.out_of_stock}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 text-xs uppercase font-bold">
              <tr>
                <th className={cn("px-6 py-4", language === 'ar' && "text-right")}>{t.product_name}</th>
                <th className={cn("px-6 py-4", language === 'ar' && "text-right")}>{t.category}</th>
                <th className={cn("px-6 py-4", language === 'ar' && "text-right")}>{language === 'ar' ? 'المورد' : 'Fournisseur'}</th>
                <th className={cn("px-6 py-4", language === 'ar' && "text-right")}>{t.price}</th>
                <th className={cn("px-6 py-4", language === 'ar' && "text-right")}>{t.stock}</th>
                <th className={cn("px-6 py-4", language === 'ar' && "text-right")}>{t.place}</th>
                <th className={cn("px-6 py-4 text-right", language === 'ar' && "text-left")}>{language === 'ar' ? 'الإجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-orange-500" />
                  </td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 dark:text-orange-400 overflow-hidden">
                        {product.photoUrl ? (
                          <img src={product.photoUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5" />
                        )}
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-md text-xs font-medium">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {product.supplierId ? supplierMap.get(product.supplierId) || '-' : '-'}
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900 dark:text-white">
                    <div className="text-sm">{formatCurrency(product.price)}</div>
                    <div className="text-[10px] text-gray-500">{t.initial_price}: {formatCurrency(product.purchasePrice)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={cn(
                        "font-bold",
                        product.stock <= 0
                          ? "text-red-600"
                          : product.stock < LOW_STOCK_THRESHOLD
                            ? "text-amber-600"
                            : "text-gray-900 dark:text-white"
                      )}>
                        {product.stock}
                      </span>
                      <span className={cn(
                        "inline-flex w-fit px-2 py-0.5 rounded-full text-[10px] font-semibold",
                        product.stock <= 0
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          : product.stock < LOW_STOCK_THRESHOLD
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                      )}>
                        {product.stock <= 0
                          ? t.out_of_stock
                          : product.stock < LOW_STOCK_THRESHOLD
                            ? t.low_stock_filter
                            : t.in_stock}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600 dark:text-gray-400 text-sm">
                    {product.place || '-'}
                  </td>
                  <td className={cn("px-6 py-4 text-right", language === 'ar' && "text-left")}>
                    <div className={cn("flex items-center gap-2", language === 'ar' ? "justify-start" : "justify-end")}>
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setFormData({
                            name: product.name,
                            price: product.price.toString(),
                            purchasePrice: (product.purchasePrice || 0).toString(),
                            stock: product.stock.toString(),
                            category: product.category,
                            tvaRate: (product.tvaRate || 20).toString(),
                            supplierTva: (product.supplierTva || 20).toString(),
                            barcode: product.barcode || '',
                            place: product.place || '',
                            photoUrl: product.photoUrl || '',
                            supplierId: (product as any).supplierId || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(product._id)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    {language === 'ar' ? 'لم يتم العثور على منتجات' : 'Aucun produit trouvé'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-8 shadow-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.import_csv}</h2>
              <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-auto space-y-6">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all cursor-pointer group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".csv" 
                  className="hidden" 
                />
                <div className="bg-gray-100 dark:bg-gray-900 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/40 p-4 rounded-full inline-block mb-4 transition-colors">
                  <FileText className="w-8 h-8 text-gray-400 group-hover:text-orange-500" />
                </div>
                <p className="font-bold text-gray-900 dark:text-white">{language === 'ar' ? 'انقر لاختيار ملف CSV' : 'Cliquez pour sélectionner un fichier CSV'}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{language === 'ar' ? 'الصيغة المطلوبة: name, price, stock, category, tvaRate' : 'Format requis: name, price, stock, category, tvaRate'}</p>
              </div>

              {importErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold mb-2">
                    <AlertCircle className="w-5 h-5" />
                    <span>{language === 'ar' ? 'أخطاء التحقق' : 'Erreurs de validation'} ({importErrors.length})</span>
                  </div>
                  <ul className="text-sm text-red-500 dark:text-red-400 list-disc list-inside space-y-1">
                    {importErrors.slice(0, 5).map((err, i) => <li key={i}>{err}</li>)}
                    {importErrors.length > 5 && <li>...et {importErrors.length - 5} autres erreurs</li>}
                  </ul>
                </div>
              )}

              {importData.length > 0 && importErrors.length === 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>{language === 'ar' ? 'جاهز لاستيراد' : 'Prêt à importer'} {importData.length} {language === 'ar' ? 'منتجات' : 'produits'}</span>
                  </div>
                </div>
              )}

              {importData.length > 0 && (
                <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 font-bold">
                      <tr>
                        <th className="px-4 py-2">{t.product_name}</th>
                        <th className="px-4 py-2">{t.price}</th>
                        <th className="px-4 py-2">{t.stock}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                      {importData.slice(0, 5).map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-2 truncate max-w-[150px] dark:text-white">{row.name}</td>
                          <td className="px-4 py-2 dark:text-white">{row.price} DH</td>
                          <td className="px-4 py-2 dark:text-white">{row.stock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importData.length > 5 && (
                    <div className="p-2 bg-gray-50 dark:bg-gray-900/50 text-center text-xs text-gray-500">
                      + {importData.length - 5} {language === 'ar' ? 'منتجات أخرى' : 'autres produits'}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-6 mt-6 border-t border-gray-100 dark:border-gray-700">
              <button 
                onClick={() => setIsImportModalOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {language === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button 
                onClick={handleBulkImport}
                disabled={importData.length === 0 || importErrors.length > 0 || isImporting}
                className="flex-1 px-4 py-2 bg-orange-500 disabled:bg-gray-300 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
              >
                {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : (language === 'ar' ? 'تأكيد الاستيراد' : 'Confirmer l\'import')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
              {editingProduct ? t.edit_product : t.add_product}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="flex flex-col items-center gap-4 mb-6">
                <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-gray-900 border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center overflow-hidden relative group">
                  {formData.photoUrl ? (
                    <>
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                        <button 
                          type="button"
                          onClick={() => {
                            setImgSrc(formData.photoUrl);
                            setShowCropModal(true);
                          }}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors"
                          title={t.crop_photo}
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, photoUrl: '' })}
                          className="p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center gap-1 text-gray-400 hover:text-orange-500 transition-colors">
                      <Upload className="w-8 h-8" />
                      <span className="text-[10px] font-bold uppercase">{t.photo}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={onSelectFile}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.product_name}</label>
                <input 
                  type="text" 
                  required
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.barcode}</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="EAN / UPC / Code 128"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 font-bold text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-900/40 dark:bg-orange-900/20 dark:text-orange-300 dark:hover:bg-orange-900/30"
                  >
                    <ScanLine className="w-4 h-4" />
                    {t.scan_barcode}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.initial_price} (DH)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.pos_price} (DH)</label>
                  <input 
                    type="number" 
                    required
                    step="0.01"
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.supplier_tva} (%)</label>
                  <input 
                    type="number" 
                    required
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.supplierTva}
                    onChange={(e) => setFormData({ ...formData, supplierTva: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.tva} (%)</label>
                  <input 
                    type="number" 
                    required
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.tvaRate}
                    onChange={(e) => setFormData({ ...formData, tvaRate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.stock}</label>
                  <input 
                    type="number" 
                    required
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.place}</label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                    value={formData.place}
                    onChange={(e) => setFormData({ ...formData, place: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t.category}</label>
                <select 
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="Général">Général</option>
                  <option value="Alimentation">Alimentation</option>
                  <option value="Boissons">Boissons</option>
                  <option value="Électronique">Électronique</option>
                  <option value="Papeterie">Papeterie</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{translations[language].supplier}</label>
                <select 
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                >
                  <option value="">{language === 'ar' ? 'اختر مورداً' : 'Choisir un fournisseur'}</option>
                  {suppliers.map(s => (
                    <option key={s._id} value={s._id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {language === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
                >
                  {editingProduct ? (language === 'ar' ? 'حفظ' : 'Enregistrer') : (language === 'ar' ? 'إضافة' : 'Ajouter')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {showCropModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[60] backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{t.crop_photo}</h2>
              <button onClick={() => setShowCropModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex justify-center bg-gray-100 dark:bg-gray-900 rounded-xl overflow-hidden max-h-[50vh]">
              <ReactCrop
                crop={crop}
                onChange={(c) => setCrop(c)}
                aspect={1}
                circularCrop={false}
              >
                <img
                  ref={imgRef}
                  alt="Crop me"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  className="max-w-full max-h-[50vh] object-contain"
                />
              </ReactCrop>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setShowCropModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                {language === 'ar' ? 'إلغاء' : 'Annuler'}
              </button>
              <button 
                onClick={handleCropComplete}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg font-bold hover:bg-orange-600 transition-colors"
              >
                {language === 'ar' ? 'تأكيد' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        language={language}
        onClose={() => setIsScannerOpen(false)}
        onDetected={(barcode) => setFormData((current) => ({ ...current, barcode }))}
      />
    </div>
  );
};

export default Products;


