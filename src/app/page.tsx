"use client";

import { useEffect, useMemo, useState } from "react";
import { Query } from "appwrite";
import {
  APPWRITE_DATABASE_ID,
  APPWRITE_TABLES,
  tablesDB,
} from "@/lib/appwrite";

type CategoryRow = {
  $id: string;
  name_ar: string;
  name_en?: string;
  description_ar?: string;
  is_active?: boolean;
  sort_order?: number;
};

type ProductRow = {
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

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("ar");
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.category_id === activeCategory;
      const matchesSearch =
        !term ||
        product.name_ar.toLocaleLowerCase("ar").includes(term) ||
        (product.name_en ?? "").toLocaleLowerCase("en").includes(term) ||
        (product.description_ar ?? "").toLocaleLowerCase("ar").includes(term);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, search]);

  return (
    <main className="bella-page">
      <div className="announcement-bar">
        <span className="announcement-dot" />
        <span>أهلًا بك في بيلا روز — حيث تبدأ الحكاية بتفصيلة جميلة</span>
      </div>

      <header className="site-header">
        <a className="brand-lockup" href="/" aria-label="Bella Roses الرئيسية">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span className="brand-name">
            <strong>BELLA ROSES</strong>
            <small>THE ART OF HOSPITALITY</small>
          </span>
        </a>
        <a className="header-action" href="#menu">استكشف القائمة <span aria-hidden="true">↙</span></a>
      </header>

      <section className="hero-section">
        <div className="hero-copy">
          <p className="eyebrow"><span /> A LITTLE MOMENT OF BEAUTY</p>
          <h1>لحظاتك الجميلة<br /><em>تستحق الأفضل.</em></h1>
          <p className="hero-description">
            في بيلا روز، نؤمن أن التفاصيل الصغيرة تصنع فرقًا كبيرًا.
            اكتشف قائمتنا واستمتع بتجربة ضيافة صُممت لتبهج حواسك.
          </p>
          <a className="primary-link" href="#menu">تصفّح القائمة <span aria-hidden="true">←</span></a>
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
                  <span>✿</span>
                  {product.is_featured ? <small>اختيارنا</small> : null}
                </div>
                <div className="product-info">
                  <div>
                    <h3>{product.name_ar}</h3>
                    {product.name_en ? <p className="product-en">{product.name_en}</p> : null}
                    {product.description_ar ? <p className="product-description">{product.description_ar}</p> : null}
                  </div>
                  <strong className="product-price">{product.price.toFixed(2)} <small>ر.س</small></strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="site-footer">
        <a className="footer-brand" href="/">BELLA ROSES<span>✿</span></a>
        <p>كل لحظة جميلة تبدأ بتفصيلة.</p>
        <span className="footer-copy">© {new Date().getFullYear()} BELLA ROSES. ALL RIGHTS RESERVED.</span>
      </footer>
    </main>
  );
}
