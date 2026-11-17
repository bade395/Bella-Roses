"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

type AdminUser = { id: string; email: string; name: string };
type Category = {
  $id: string; name_ar: string; name_en: string; description_ar?: string;
  description_en?: string; image_id?: string; is_active?: boolean; sort_order?: number;
};
type Product = {
  $id: string; category_id: string; name_ar: string; name_en: string;
  description_ar?: string; description_en?: string; price: number; image_id?: string;
  is_available?: boolean; is_featured?: boolean; sort_order?: number;
};
type CategoryForm = {
  name_ar: string; name_en: string; description_ar: string; description_en: string;
  is_active: boolean; sort_order: number;
};
type ProductForm = {
  category_id: string; name_ar: string; name_en: string; description_ar: string;
  description_en: string; price: string; image_id: string; is_available: boolean;
  is_featured: boolean; sort_order: number;
};

const emptyCategory: CategoryForm = {
  name_ar: "", name_en: "", description_ar: "", description_en: "", is_active: true, sort_order: 0,
};
const emptyProduct: ProductForm = {
  category_id: "", name_ar: "", name_en: "", description_ar: "", description_en: "",
  price: "", image_id: "", is_available: true, is_featured: false, sort_order: 0,
};

export default function AdminHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategory);
  const [productForm, setProductForm] = useState<ProductForm>(emptyProduct);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const cropDrag = useRef<{ pointerId: number; startX: number; startY: number; cropX: number; cropY: number } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!imageFile) { setImagePreviewUrl(""); return; }
    const url = URL.createObjectURL(imageFile);
    setImagePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [categoryResponse, productResponse] = await Promise.all([
        fetch("/api/admin/menu?kind=categories", { cache: "no-store" }),
        fetch("/api/admin/menu?kind=products", { cache: "no-store" }),
      ]);
      if (categoryResponse.status === 401 || productResponse.status === 401) {
        router.replace("/admin/login");
        return;
      }
      if (!categoryResponse.ok || !productResponse.ok) {
        const failed = !categoryResponse.ok ? categoryResponse : productResponse;
        const data = await failed.json().catch(() => ({}));
        throw new Error(data.error ?? "تعذّر تحميل بيانات القائمة.");
      }
      const [categoryData, productData] = await Promise.all([categoryResponse.json(), productResponse.json()]);
      setCategories(categoryData.rows ?? []);
      setProducts(productData.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/me", { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unauthorized");
        return response.json() as Promise<{ user: AdminUser }>;
      })
      .then(result => { if (active) setUser(result.user); })
      .catch(() => { router.replace("/admin/login"); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [router]);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/admin/login");
    router.refresh();
  }

  function startNew() {
    setEditingId(null);
    setError("");
    setNotice("");
    setImageFile(null);
    setCategoryForm(emptyCategory);
    setProductForm({ ...emptyProduct, category_id: categories.find(item => item.is_active !== false)?.$id ?? "" });
    setShowForm(true);
  }

  function editCategory(item: Category) {
    setEditingId(item.$id);
    setCategoryForm({
      name_ar: item.name_ar, name_en: item.name_en, description_ar: item.description_ar ?? "",
      description_en: item.description_en ?? "", is_active: item.is_active !== false,
      sort_order: item.sort_order ?? 0,
    });
    setShowForm(true); setError(""); setNotice("");
  }

  function editProduct(item: Product) {
    setEditingId(item.$id);
    setProductForm({
      category_id: item.category_id, name_ar: item.name_ar, name_en: item.name_en,
      description_ar: item.description_ar ?? "", description_en: item.description_en ?? "",
      price: String(item.price), image_id: item.image_id ?? "", is_available: item.is_available !== false,
      is_featured: item.is_featured === true, sort_order: item.sort_order ?? 0,
    });
    setImageFile(null); setCropX(50); setCropY(50); setShowForm(true); setError(""); setNotice("");
  }

  function startCropDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (!imagePreviewUrl || event.button !== 0) return;
    cropDrag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, cropX, cropY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDrag.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCropX(Math.max(0, Math.min(100, drag.cropX - ((event.clientX - drag.startX) / bounds.width) * 100)));
    setCropY(Math.max(0, Math.min(100, drag.cropY - ((event.clientY - drag.startY) / bounds.height) * 100)));
  }

  function endCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (cropDrag.current?.pointerId === event.pointerId) cropDrag.current = null;
  }

  async function uploadImage() {
    if (!imageFile) return productForm.image_id;

    // Normalize every menu photo to 1200x900 (4:3), cropping without stretching.
    const source = await createImageBitmap(imageFile);
    const targetRatio = 4 / 3;
    let sourceWidth = source.width;
    let sourceHeight = source.height;
    if (sourceWidth / sourceHeight > targetRatio) {
      sourceWidth = sourceHeight * targetRatio;
    } else {
      sourceHeight = sourceWidth / targetRatio;
    }
    const sourceX = (source.width - sourceWidth) * (cropX / 100);
    const sourceY = (source.height - sourceHeight) * (cropY / 100);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 900;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذّر تجهيز الصورة. جرّب ملفًا آخر.");
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 1200, 900);
    source.close();
    const processedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("تعذّر معالجة الصورة.")), "image/webp", 0.9);
    });
    const processedFile = new File([processedBlob], "bella-menu-image.webp", { type: "image/webp" });
    const form = new FormData();
    form.set("file", processedFile);
    const response = await fetch("/api/admin/menu-image", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error ?? "تعذّر رفع الصورة.");
    return result.fileId as string;
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      const kind = tab;
      let payload: Record<string, unknown>;
      if (kind === "categories") {
        payload = { kind, ...categoryForm };
      } else {
        if (!productForm.category_id) throw new Error("أضف تصنيفًا أولًا قبل إضافة المنتجات.");
        const imageId = await uploadImage();
        payload = { kind, ...productForm, price: Number(productForm.price), image_id: imageId };
      }
      const response = await fetch("/api/admin/menu", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "تعذّر حفظ البيانات.");
      setShowForm(false); setEditingId(null); setImageFile(null);
      setNotice(editingId ? "تم حفظ التعديلات بنجاح." : "تمت الإضافة بنجاح.");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذّر حفظ البيانات.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(kind: "categories" | "products", item: Category | Product) {
    const field = kind === "categories" ? "is_active" : "is_available";
    const current = kind === "categories"
      ? (item as Category).is_active !== false
      : (item as Product).is_available !== false;
    setError(""); setNotice("");
    const response = await fetch("/api/admin/menu", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id: item.$id, [field]: !current }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "تعذّر تحديث الحالة."); return; }
    setNotice("تم تحديث حالة العنصر.");
    await loadData();
  }

  const categoryNames = useMemo(() => new Map(categories.map(item => [item.$id, item.name_ar])), [categories]);
  const filteredCategories = categories.filter(item =>
    (item.name_ar + " " + item.name_en).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );
  const filteredProducts = products.filter(item =>
    (item.name_ar + " " + item.name_en).toLocaleLowerCase().includes(search.toLocaleLowerCase())
  );

  if (checking || !user) {
    return <main className="admin-auth-page"><p className="admin-auth-copy">جارٍ التحقق من صلاحيات الدخول...</p></main>;
  }

  const imageUrl = (fileId: string) =>
    `https://fra.cloud.appwrite.io/v1/storage/buckets/menu_images/files/${encodeURIComponent(fileId)}/view?project=6afac57c0019b2ee5fa0`;

  return <main className="admin-dashboard">
    <header className="admin-dashboard-header">
      <Link className="admin-auth-brand" href="/">BELLA ROSES <span>✿</span></Link>
      <div className="admin-header-actions"><span className="admin-user-email">{user.email}</span><Link className="admin-tables-link" href="/admin/orders">إدارة الطلبات</Link><Link className="admin-tables-link" href="/admin/orders/archive">أرشيف الطلبات</Link><Link className="admin-tables-link" href="/admin/reports">تقارير المبيعات</Link><Link className="admin-tables-link" href="/admin/tables">إدارة الطاولات و QR</Link><button onClick={logout} className="admin-logout">تسجيل الخروج</button></div>
    </header>
    <section className="admin-dashboard-content admin-menu-content">
      <p className="admin-auth-eyebrow">BELLA ROSES CONTROL CENTER</p>
      <h1>إدارة القائمة</h1>
      <p>تحكّم في تصنيفات ومنتجات بيلا روز، وتظهر التغييرات على المنيو بعد حفظها.</p>

      <div className="admin-stats">
        <div><span>التصنيفات</span><strong>{categories.length}</strong></div>
        <div><span>المنتجات</span><strong>{products.length}</strong></div>
        <div><span>المتاحة</span><strong>{products.filter(item => item.is_available !== false).length}</strong></div>
      </div>

      <div className="admin-menu-toolbar">
        <div className="admin-menu-tabs">
          <button className={tab === "products" ? "active" : ""} onClick={() => { setTab("products"); setShowForm(false); setSearch(""); setError(""); }}>المنتجات</button>
          <button className={tab === "categories" ? "active" : ""} onClick={() => { setTab("categories"); setShowForm(false); setSearch(""); setError(""); }}>التصنيفات</button>
        </div>
        <button className="admin-primary-button" onClick={startNew}>＋ إضافة {tab === "products" ? "منتج" : "تصنيف"}</button>
      </div>

      {notice ? <p className="admin-notice" role="status">{notice}</p> : null}
      {error ? <p className="admin-error-banner" role="alert">{error}</p> : null}

      {showForm ? <form className="admin-editor" onSubmit={submitForm}>
        <div className="admin-editor-heading"><h2>{editingId ? "تعديل" : "إضافة"} {tab === "products" ? "منتج" : "تصنيف"}</h2><button type="button" onClick={() => setShowForm(false)} aria-label="إغلاق">×</button></div>
        {tab === "categories" ? <>
          <div className="admin-form-grid">
            <label>الاسم بالعربية<input required maxLength={120} value={categoryForm.name_ar} onChange={e => setCategoryForm({ ...categoryForm, name_ar: e.target.value })} /></label>
            <label>الاسم بالإنجليزية<input required maxLength={120} dir="ltr" value={categoryForm.name_en} onChange={e => setCategoryForm({ ...categoryForm, name_en: e.target.value })} /></label>
            <label>الوصف بالعربية<textarea value={categoryForm.description_ar} onChange={e => setCategoryForm({ ...categoryForm, description_ar: e.target.value })} /></label>
            <label>الوصف بالإنجليزية<textarea dir="ltr" value={categoryForm.description_en} onChange={e => setCategoryForm({ ...categoryForm, description_en: e.target.value })} /></label>
            <label>ترتيب العرض<input type="number" step="1" value={categoryForm.sort_order} onChange={e => setCategoryForm({ ...categoryForm, sort_order: Number(e.target.value) })} /></label>
            <label className="admin-check-label"><input type="checkbox" checked={categoryForm.is_active} onChange={e => setCategoryForm({ ...categoryForm, is_active: e.target.checked })} /> تصنيف نشط</label>
          </div>
        </> : <>
          <div className="admin-form-grid">
            <label>التصنيف<select required value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}><option value="">اختر التصنيف</option>{categories.filter(item => item.is_active !== false).map(item => <option key={item.$id} value={item.$id}>{item.name_ar}</option>)}</select></label>
            <label>السعر (ر.س)<input required type="number" min="0" max="1000000" step="0.01" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })} /></label>
            <label>اسم المنتج بالعربية<input required maxLength={160} value={productForm.name_ar} onChange={e => setProductForm({ ...productForm, name_ar: e.target.value })} /></label>
            <label>اسم المنتج بالإنجليزية<input required maxLength={160} dir="ltr" value={productForm.name_en} onChange={e => setProductForm({ ...productForm, name_en: e.target.value })} /></label>
            <label>الوصف بالعربية<textarea value={productForm.description_ar} onChange={e => setProductForm({ ...productForm, description_ar: e.target.value })} /></label>
            <label>الوصف بالإنجليزية<textarea dir="ltr" value={productForm.description_en} onChange={e => setProductForm({ ...productForm, description_en: e.target.value })} /></label>
            <label className="admin-file-label">صورة المنتج<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => { setImageFile(e.target.files?.[0] ?? null); setCropX(50); setCropY(50); }} /><small>{imageFile ? imageFile.name : productForm.image_id ? "تم ربط صورة بهذا المنتج — اختر ملفًا لاستبدالها" : "JPG / PNG / WebP / AVIF — حتى 5MB"}</small></label>
            {imageFile && imagePreviewUrl ? <div className="admin-image-editor">
              <div className="admin-image-preview" onPointerDown={startCropDrag} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} role="group" aria-label="اسحب الصورة داخل الإطار لضبط القص"><Image src={imagePreviewUrl} alt="معاينة مباشرة للصورة بعد القص" width={1200} height={900} unoptimized draggable={false} style={{ objectFit: "cover", objectPosition: `${cropX}% ${cropY}%` }} /><span className="admin-crop-grid" aria-hidden="true" /><span className="admin-crop-hint">اسحب الصورة لضبط الجزء الظاهر</span></div>
              <div className="admin-image-controls">
                <strong>ضبط إطار الصورة</strong>
                <small>المقاس النهائي 1200 × 900 بكسل (4:3). اسحب الصورة نفسها داخل الإطار أو استخدم المؤشرات لضبط الجزء الظاهر مباشرةً.</small>
                <label>أفقي <input type="range" min="0" max="100" value={cropX} onChange={e => setCropX(Number(e.target.value))} /></label>
                <label>رأسي <input type="range" min="0" max="100" value={cropY} onChange={e => setCropY(Number(e.target.value))} /></label>
                <button type="button" className="admin-secondary-button" onClick={() => { setCropX(50); setCropY(50); }}>إعادة ضبط القص</button>
              </div>
            </div> : null}
            <label>ترتيب العرض<input type="number" step="1" value={productForm.sort_order} onChange={e => setProductForm({ ...productForm, sort_order: Number(e.target.value) })} /></label>
            <label className="admin-check-label"><input type="checkbox" checked={productForm.is_available} onChange={e => setProductForm({ ...productForm, is_available: e.target.checked })} /> متاح في المنيو</label>
            <label className="admin-check-label"><input type="checkbox" checked={productForm.is_featured} onChange={e => setProductForm({ ...productForm, is_featured: e.target.checked })} /> منتج مميز</label>
          </div>
        </>}
        <div className="admin-editor-actions"><button type="button" className="admin-secondary-button" onClick={() => setShowForm(false)}>إلغاء</button><button className="admin-primary-button" disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ البيانات"}</button></div>
      </form> : null}

      <div className="admin-list-toolbar"><input placeholder={tab === "products" ? "ابحث عن منتج..." : "ابحث عن تصنيف..."} value={search} onChange={e => setSearch(e.target.value)} /><button onClick={() => void loadData()}>↻ تحديث</button></div>
      {loading ? <div className="admin-empty-state">جارٍ تحميل بيانات القائمة...</div> : tab === "categories" ? (
        filteredCategories.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>التصنيف</th><th>الاسم الإنجليزي</th><th>المنتجات</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{filteredCategories.map(item => <tr key={item.$id}><td><strong>{item.name_ar}</strong></td><td dir="ltr">{item.name_en}</td><td>{products.filter(product => product.category_id === item.$id).length}</td><td><span className={item.is_active === false ? "admin-status off" : "admin-status"}>{item.is_active === false ? "مؤرشف" : "نشط"}</span></td><td><div className="admin-row-actions"><button onClick={() => editCategory(item)}>تعديل</button><button onClick={() => void toggleStatus("categories", item)}>{item.is_active === false ? "تفعيل" : "إيقاف"}</button></div></td></tr>)}</tbody></table></div> : <div className="admin-empty-state">لا توجد تصنيفات حتى الآن. أضف أول تصنيف من الزر أعلاه.</div>
      ) : (
        filteredProducts.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{filteredProducts.map(item => <tr key={item.$id}><td><div className="admin-product-cell">{item.image_id ? <Image src={imageUrl(item.image_id)} alt="" width={48} height={48} unoptimized /> : <span className="admin-product-no-image">✿</span>}<div><strong>{item.name_ar}</strong><small dir="ltr">{item.name_en}</small></div></div></td><td>{categoryNames.get(item.category_id) ?? "تصنيف غير معروف"}</td><td className="admin-price">{Number(item.price).toFixed(2)} ر.س</td><td><span className={item.is_available === false ? "admin-status off" : "admin-status"}>{item.is_available === false ? "غير متاح" : "متاح"}</span></td><td><div className="admin-row-actions"><button onClick={() => editProduct(item)}>تعديل</button><button onClick={() => void toggleStatus("products", item)}>{item.is_available === false ? "إتاحة" : "إيقاف"}</button></div></td></tr>)}</tbody></table></div> : <div className="admin-empty-state">لا توجد منتجات حتى الآن. أضف منتجاتك وأسعارك الفعلية من الزر أعلاه.</div>
      )}
      <p className="admin-data-note">تُحفظ التغييرات في Appwrite. الإيقاف يؤرشف العنصر دون حذف سجلاته أو التأثير على الطلبات السابقة.</p>
    </section>
  </main>;
}
