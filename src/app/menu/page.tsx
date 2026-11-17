"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Query, type Models } from "appwrite";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
  tablesDB,
} from "@/lib/appwrite";

type CategoryRow = Models.Row & {
  $id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  is_active?: boolean;
  sort_order?: number;
};

type CartLine = { product: ProductRow; quantity: number; notes: string };

type ProductRow = Models.Row & {
  $id: string;
  category_id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  price: number;
  image_id?: string;
  is_available?: boolean;
  is_featured?: boolean;
  sort_order?: number;
};

export default function Home() {
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tableContext, setTableContext] = useState<{ table_number: number; label: string } | null>(null);
  const [tableToken, setTableToken] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderMessage, setOrderMessage] = useState<{ id: string; order_number: string; subtotal: number; table_number: number } | null>(null);
  const [orderError, setOrderError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadMenu() {
      if (!tablesDB) {
        setLoading(false);
        setLoadError(true);
        return;
      }

      try {
        const [categoryResult, productResult] = await Promise.all([
          tablesDB.listRows<CategoryRow>({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_TABLES.categories,
            queries: [Query.equal("is_active", true), Query.orderAsc("sort_order"), Query.limit(100)],
          }),
          tablesDB.listRows<ProductRow>({
            databaseId: APPWRITE_DATABASE_ID,
            tableId: APPWRITE_TABLES.products,
            queries: [Query.equal("is_available", true), Query.orderAsc("sort_order"), Query.limit(100)],
          }),
        ]);

        if (!mounted) return;
        setCategories(categoryResult.rows);
        setProducts(productResult.rows);
      } catch {
        if (!mounted) return;
        setLoadError(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadMenu();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("table");
    if (!token) return;
    setTableToken(token);
    let active = true;
    fetch(`/api/table/resolve?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("رمز الطاولة غير صالح.");
        return response.json() as Promise<{ table: { table_number: number; label: string } }>;
      })
      .then((result) => { if (active) setTableContext(result.table); })
      .catch(() => { if (active) setTableContext(null); });
    return () => { active = false; };
  }, []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  function addToCart(product: ProductRow) {
    setCart((current) => {
      const existing = current.find((item) => item.product.$id === product.$id);
      if (existing) return current.map((item) => item.product.$id === product.$id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item);
      return [...current, { product, quantity: 1, notes: "" }];
    });
    setOrderError("");
  }

  function updateCartLine(productId: string, update: Partial<Pick<CartLine, "quantity" | "notes">>) {
    setCart((current) => current.flatMap((item) => {
      if (item.product.$id !== productId) return [item];
      const next = { ...item, ...update };
      return next.quantity <= 0 ? [] : [{ ...next, quantity: Math.min(20, next.quantity) }];
    }));
  }

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tableToken || cart.length === 0 || submitting) return;
    setSubmitting(true);
    setOrderError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table_token: tableToken,
          customer_name: customerName,
          notes: orderNotes,
          items: cart.map((item) => ({ product_id: item.product.$id, quantity: item.quantity, notes: item.notes })),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "تعذّر تسجيل الطلب.");
      setOrderMessage(result.order);
      setCart([]);
      setCustomerName("");
      setOrderNotes("");
    } catch (cause) {
      setOrderError(cause instanceof Error ? cause.message : "تعذّر تسجيل الطلب.");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    const activeCategoryIds = new Set(categories.map((category) => category.$id));
    return products.filter((product) => {
      const belongsToActiveCategory = activeCategoryIds.has(product.category_id);
      const matchesCategory =
        activeCategory === "all" || product.category_id === activeCategory;
      const matchesSearch =
        !term ||
        product.name_ar.toLocaleLowerCase("ar").includes(term) ||
        (product.name_en ?? "").toLocaleLowerCase("en").includes(term) ||
        (product.description_ar ?? "").toLocaleLowerCase("ar").includes(term);
      return belongsToActiveCategory && matchesCategory && matchesSearch;
    });
  }, [activeCategory, categories, products, search]);

  return (
    <main className="bella-page">
      <div className="announcement-bar">
        <span className="announcement-dot" />
        <span>أهلًا بك في بيلا روز — حيث تبدأ الحكاية بتفصيلة جميلة</span>
      </div>

      {tableContext ? <div className="table-context-banner" role="status">تم التعرّف على طاولتك <strong>رقم {tableContext.table_number}</strong>{tableContext.label ? ` — ${tableContext.label}` : ""}</div> : null}

      <header className="site-header">
        <Link className="brand-lockup" href="/menu" aria-label="Bella Roses القائمة">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-name">
            <strong>BELLA ROSES</strong>
            <small>THE ART OF HOSPITALITY</small>
          </span>
        </Link>
        <Link className="header-action" href="#menu">استكشف القائمة <span aria-hidden="true">↙</span></Link>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span /> A LITTLE MOMENT OF BEAUTY</p>
          <h1>لحظاتك الجميلة<br /><em>تستحق الأفضل.</em></h1>
          <p className="hero-description">
            في بيلا روز، نؤمن أن التفاصيل الصغيرة تصنع فرقًا كبيرًا.
            اكتشف قائمتنا واستمتع بتجربة ضيافة صُممت لتبهج حواسك.
          </p>
          <Link className="primary-link" href="#menu">تصفّح القائمة <span aria-hidden="true">←</span></Link>
        </div>
        <div className="hero-art" aria-label="تصميم زخرفي مستوحى من الورود" role="img">
          <div className="art-orbit orbit-one" />
          <div className="art-orbit orbit-two" />
          <div className="art-center">
            <span className="art-flower">✿</span>
            <span className="art-script">Bella</span>
            <span className="art-caption">A BEAUTIFUL EXPERIENCE</span>
          </div>
          <span className="art-spark spark-one">✧</span>
          <span className="art-spark spark-two">✦</span>
          <span className="art-leaf leaf-one">❧</span>
          <span className="art-leaf leaf-two">❧</span>
        </div>
        <div className="hero-footnote"><span>01</span> MADE WITH LOVE, SERVED WITH GRACE</div>
      </section>

      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><span /> OUR SELECTION</p>
            <h2>قائمة <em>بيلا روز</em></h2>
            <p className="section-subtitle">اختياراتنا، بتفاصيل تليق بلحظاتك.</p>
          </div>
          <div className="menu-count">{products.length.toString().padStart(2, "0")} <span>ITEMS</span></div>
        </div>

        <div className="menu-toolbar">
          <div className="category-tabs" aria-label="تصنيفات القائمة">
            <button
              className={activeCategory === "all" ? "category-tab active" : "category-tab"}
              onClick={() => setActiveCategory("all")}
              type="button"
            >
              الكل
            </button>
            {categories.map((category) => (
              <button
                className={activeCategory === category.$id ? "category-tab active" : "category-tab"}
                key={category.$id}
                onClick={() => setActiveCategory(category.$id)}
                type="button"
              >
                {category.name_ar}
              </button>
            ))}
          </div>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label="ابحث في القائمة"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث في القائمة..."
              value={search}
            />
          </label>
        </div>

        {loading ? (
          <div className="menu-state">
            <span className="loading-flower">✿</span>
            <p>نجهّز لك القائمة...</p>
          </div>
        ) : loadError ? (
          <div className="menu-state">
            <span className="state-flower">✿</span>
            <h3>القائمة غير متاحة مؤقتًا</h3>
            <p>حاول تحديث الصفحة بعد قليل.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="menu-state empty-state">
            <span className="state-flower">✿</span>
            <p className="empty-kicker">A NEW CHAPTER IS BLOOMING</p>
            <h3>قائمتنا تُحضّر بعناية.</h3>
            <p>نعمل على تجهيز اختيارات بيلا روز لتكون على ذوقك تمامًا. ترقّب زيارتك القادمة.</p>
            <span className="empty-line" />
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="menu-state">
            <span className="state-flower">⌕</span>
            <h3>لم نعثر على نتائج</h3>
            <p>جرّب كلمة بحث أخرى أو اختر تصنيفًا مختلفًا.</p>
          </div>
        ) : (
          <div className="product-grid">
            {visibleProducts.map((product) => (
              <article className="product-card" key={product.$id}>
                <div className="product-placeholder">
                  {product.image_id ? (
                    <Image
                      src={`${process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT}/storage/buckets/menu_images/files/${encodeURIComponent(product.image_id)}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`}
                      alt={product.name_ar}
                      fill
                      sizes="(max-width: 420px) 100vw, (max-width: 760px) 50vw, 33vw"
                      unoptimized
                    />
                  ) : <span>✿</span>}
                  {product.is_featured ? <small>اختيارنا</small> : null}
                </div>
                <div className="product-info">
                  <div>
                    <h3>{product.name_ar}</h3>
                    {product.name_en ? <p className="product-en">{product.name_en}</p> : null}
                    {product.description_ar ? <p className="product-description">{product.description_ar}</p> : null}
                  </div>
                  <div className="product-card-footer">
                    <strong className="product-price">{product.price.toFixed(2)} <small>ر.س</small></strong>
                    {tableContext ? <button className="add-to-cart-button" type="button" onClick={() => addToCart(product)}>أضف للطلب <span>＋</span></button> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {tableContext ? (
        <>
          <button className="cart-floating-button" type="button" onClick={() => { setOrderMessage(null); setCartOpen(true); }}>
            <span>عرض الطلب</span><strong>{cartCount}</strong><b>{cartTotal.toFixed(2)} ر.س</b>
          </button>
          {cartOpen ? (
            <div className="cart-backdrop" role="presentation" onClick={() => setCartOpen(false)}>
              <section className="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cart-title" onClick={(event) => event.stopPropagation()}>
                <div className="cart-panel-heading">
                  <div><p className="eyebrow"><span /> BELLA ROSES</p><h2 id="cart-title">{orderMessage ? "تم استلام طلبك" : "طلبك من بيلا روز"}</h2></div>
                  <button type="button" aria-label="إغلاق" onClick={() => setCartOpen(false)}>×</button>
                </div>
                {orderMessage ? (
                  <div className="order-success">
                    <span>✿</span><p>وصل طلبك للمطعم بنجاح.</p>
                    <strong>{orderMessage.order_number}</strong>
                    <small>الطاولة {orderMessage.table_number} · {orderMessage.subtotal.toFixed(2)} ر.س</small>
                    <Link className="cart-submit-button track-order-button" href={`/order/${orderMessage.id}`}>تابع حالة طلبك</Link>
                    <button className="cart-submit-button" type="button" onClick={() => { setOrderMessage(null); setCartOpen(false); }}>العودة للقائمة</button>
                  </div>
                ) : cart.length === 0 ? (
                  <div className="cart-empty">سلتك فارغة حاليًا. أضف اختياراتك من القائمة.</div>
                ) : (
                  <form className="cart-form" onSubmit={submitOrder}>
                    <div className="cart-lines">
                      {cart.map((item) => (
                        <article className="cart-line" key={item.product.$id}>
                          <div className="cart-line-top">
                            <div><strong>{item.product.name_ar}</strong><small>{item.product.price.toFixed(2)} ر.س للوحدة</small></div>
                            <strong>{(item.product.price * item.quantity).toFixed(2)} ر.س</strong>
                          </div>
                          <div className="cart-line-controls">
                            <div className="quantity-control">
                              <button type="button" aria-label="زيادة الكمية" onClick={() => updateCartLine(item.product.$id, { quantity: item.quantity + 1 })}>＋</button>
                              <span>{item.quantity}</span>
                              <button type="button" aria-label="تقليل الكمية" onClick={() => updateCartLine(item.product.$id, { quantity: item.quantity - 1 })}>−</button>
                            </div>
                            <button className="remove-cart-line" type="button" onClick={() => updateCartLine(item.product.$id, { quantity: 0 })}>حذف</button>
                          </div>
                          <input className="cart-item-note" maxLength={500} placeholder="ملاحظة لهذا الصنف (اختياري)" value={item.notes} onChange={(event) => updateCartLine(item.product.$id, { notes: event.target.value })} />
                        </article>
                      ))}
                    </div>
                    <label className="cart-field">الاسم (اختياري)<input maxLength={120} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="اسمك" /></label>
                    <label className="cart-field">ملاحظات الطلب<textarea maxLength={1500} rows={2} value={orderNotes} onChange={(event) => setOrderNotes(event.target.value)} placeholder="أي تفاصيل إضافية..." /></label>
                    {orderError ? <p className="cart-error" role="alert">{orderError}</p> : null}
                    <div className="cart-total-row"><span>الإجمالي</span><strong>{cartTotal.toFixed(2)} ر.س</strong></div>
                    <p className="cart-payment-note">الدفع غير متاح إلكترونيًا حاليًا؛ يتم الدفع لدى المطعم.</p>
                    <button className="cart-submit-button" type="submit" disabled={submitting}>{submitting ? "جارٍ إرسال الطلب..." : "تأكيد الطلب"}</button>
                  </form>
                )}
              </section>
            </div>
          ) : null}
        </>
      ) : null}

      <footer className="site-footer">
        <Link className="footer-brand" href="/menu">BELLA ROSES<span>✿</span></Link>
        <p>كل لحظة جميلة تبدأ بتفصيلة.</p>
        <span className="footer-copy">© {new Date().getFullYear()} BELLA ROSES. ALL RIGHTS RESERVED.</span>
      </footer>
    </main>
  );
}
