import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";
import { getStaffUser } from "@/lib/staff-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_ID = process.env.BADE3_CORE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";
const TABLES = { categories: "categories", products: "products" } as const;
type Kind = keyof typeof TABLES;

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function requireAdmin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return null;
  return getStaffUser("menu.manage");
}

function cleanText(value: unknown, max: number, required = false) {
  if (typeof value !== "string") return required ? null : "";
  const text = value.trim();
  if ((required && !text) || text.length > max) return null;
  return text;
}

function validKind(value: unknown): value is Kind {
  return value === "categories" || value === "products";
}

async function appwrite(path: string, init: RequestInit = {}) {
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) {
    throw new Error("SERVER_CONFIG");
  }
  const response = await fetch(`${APPWRITE_ENDPOINT}${path}`, {
    ...init,
    headers: {
      "X-Appwrite-Project": APPWRITE_PROJECT_ID,
      "X-Appwrite-Key": key,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error("Appwrite menu operation failed", {
      status: response.status,
      type: (payload as { type?: string }).type ?? "unknown",
      message: (payload as { message?: string }).message ?? "unknown",
    });
    const error = new Error(response.status === 401 || response.status === 403 ? "APPWRITE_SCOPE" : "APPWRITE_REQUEST");
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  return payload as Record<string, unknown>;
}

function handleError(error: unknown) {
  if (error instanceof Error && error.message === "SERVER_CONFIG") {
    return jsonError("إعدادات اتصال قاعدة البيانات غير مكتملة.", 503);
  }
  if (error instanceof Error && error.message === "APPWRITE_SCOPE") {
    return jsonError("مفتاح Appwrite لا يملك صلاحيات قراءة وكتابة جداول القائمة.", 503);
  }
  console.error("Admin menu API error", error);
  return jsonError("تعذّر تنفيذ العملية. حاول مرة أخرى.", 502);
}

export async function GET(request: Request) {
  const admin = await getStaffUser("menu.manage");
  if (!admin) return jsonError("غير مصرح.", 401);
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");
  if (!validKind(kind)) return jsonError("نوع البيانات غير صالح.");
  try {
    const query = encodeURIComponent(JSON.stringify({ method: "equal", attribute: "tenant_id", values: [admin.tenantId] }));
    const limit = encodeURIComponent(JSON.stringify({ method: "limit", values: [100] }));
    const result = await appwrite(
      `/tablesdb/${DATABASE_ID}/tables/${TABLES[kind]}/rows?queries[]=${query}&queries[]=${limit}`
    );
    const rows = Array.isArray(result.rows) ? result.rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      const data = row.data && typeof row.data === "object" ? row.data as Record<string, unknown> : {};
      return { ...row, ...data };
    }) : [];
    return NextResponse.json({ ...result, rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("غير مصرح أو مصدر الطلب غير موثوق.", 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError("بيانات الطلب غير صالحة."); }
  const kind = body.kind;
  if (!validKind(kind)) return jsonError("نوع البيانات غير صالح.");

  let data: Record<string, unknown>;
  if (kind === "categories") {
    const nameAr = cleanText(body.name_ar, 120, true);
    const nameEn = cleanText(body.name_en, 120, true);
    if (!nameAr || !nameEn) return jsonError("اسم التصنيف بالعربية والإنجليزية مطلوب (حتى 120 حرفًا).");
    data = {
      tenant_id: admin.tenantId,
      name_ar: nameAr,
      name_en: nameEn,
      description_ar: cleanText(body.description_ar, 2000),
      description_en: cleanText(body.description_en, 2000),
      is_active: body.is_active !== false,
      sort_order: Number.isInteger(body.sort_order) ? Number(body.sort_order) : 0,
    };
  } else {
    const categoryId = cleanText(body.category_id, 36, true);
    const nameAr = cleanText(body.name_ar, 160, true);
    const nameEn = cleanText(body.name_en, 160, true);
    const price = typeof body.price === "number" ? body.price : Number(body.price);
    if (!categoryId || !nameAr || !nameEn) return jsonError("التصنيف والاسم بالعربية والإنجليزية حقول مطلوبة.");
    if (!Number.isFinite(price) || price < 0 || price > 1000000) return jsonError("أدخل سعرًا صحيحًا غير سالب.");
    const category = await appwrite(`/tablesdb/${DATABASE_ID}/tables/categories/rows/${encodeURIComponent(categoryId)}`);
    const categoryData = category.data && typeof category.data === "object" ? category.data as Record<string, unknown> : category;
    if (!category.$id || categoryData.tenant_id !== admin.tenantId || categoryData.is_active === false) return jsonError("التصنيف المحدد غير موجود أو غير نشط.");
    data = {
      tenant_id: admin.tenantId,
      category_id: categoryId,
      name_ar: nameAr,
      name_en: nameEn,
      description_ar: cleanText(body.description_ar, 2000),
      description_en: cleanText(body.description_en, 2000),
      price,
      image_id: cleanText(body.image_id, 64),
      is_available: body.is_available !== false,
      is_featured: body.is_featured === true,
      sort_order: Number.isInteger(body.sort_order) ? Number(body.sort_order) : 0,
    };
  }

  try {
    const result = await appwrite(`/tablesdb/${DATABASE_ID}/tables/${TABLES[kind]}/rows`, {
      method: "POST",
      body: JSON.stringify({ rowId: randomUUID(), data }),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("غير مصرح أو مصدر الطلب غير موثوق.", 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError("بيانات الطلب غير صالحة."); }
  const kind = body.kind;
  const id = cleanText(body.id, 36, true);
  if (!validKind(kind) || !id) return jsonError("بيانات العنصر غير صالحة.");

  const allowed = kind === "categories"
    ? ["name_ar", "name_en", "description_ar", "description_en", "is_active", "sort_order"]
    : ["category_id", "name_ar", "name_en", "description_ar", "description_en", "price", "image_id", "is_available", "is_featured", "sort_order"];
  const data: Record<string, unknown> = {};
  for (const field of allowed) {
    if (!(field in body)) continue;
    const value = body[field];
    if (["name_ar", "name_en"].includes(field)) {
      const cleaned = cleanText(value, kind === "categories" ? 120 : 160, true);
      if (!cleaned) return jsonError("الاسم مطلوب وبطول صالح.");
      data[field] = cleaned;
    } else if (["description_ar", "description_en"].includes(field)) {
      const cleaned = cleanText(value, 2000);
      if (cleaned === null) return jsonError("الوصف أطول من المسموح.");
      data[field] = cleaned;
    } else if (field === "price") {
      const price = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(price) || price < 0 || price > 1000000) return jsonError("السعر غير صالح.");
      data.price = price;
    } else if (field === "sort_order") {
      if (!Number.isInteger(value)) return jsonError("ترتيب العرض يجب أن يكون رقمًا صحيحًا.");
      data.sort_order = value;
    } else if (["is_active", "is_available", "is_featured"].includes(field)) {
      if (typeof value !== "boolean") return jsonError("قيمة الحالة غير صالحة.");
      data[field] = value;
    } else if (field === "category_id" || field === "image_id") {
      const cleaned = cleanText(value, field === "category_id" ? 36 : 64, field === "category_id");
      if (cleaned === null) return jsonError("القيمة المرتبطة غير صالحة.");
      data[field] = cleaned;
    }
  }
  if (Object.keys(data).length === 0) return jsonError("لا توجد تغييرات للحفظ.");
  try {
    const current = await appwrite(`/tablesdb/${DATABASE_ID}/tables/${TABLES[kind]}/rows/${encodeURIComponent(id)}`);
    const currentData = current.data && typeof current.data === "object" ? current.data as Record<string, unknown> : current;
    if (!current.$id || currentData.tenant_id !== admin.tenantId) return jsonError("العنصر غير موجود.", 404);
    if (kind === "products" && typeof data.category_id === "string") {
      const category = await appwrite(`/tablesdb/${DATABASE_ID}/tables/categories/rows/${encodeURIComponent(data.category_id)}`);
      const categoryData = category.data && typeof category.data === "object" ? category.data as Record<string, unknown> : category;
      if (!category.$id || categoryData.tenant_id !== admin.tenantId || categoryData.is_active === false) return jsonError("التصنيف المحدد غير موجود أو غير نشط.");
    }
    const result = await appwrite(
      `/tablesdb/${DATABASE_ID}/tables/${TABLES[kind]}/rows/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ data }) }
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("غير مصرح أو مصدر الطلب غير موثوق.", 403);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return jsonError("بيانات الطلب غير صالحة."); }
  const kind = body.kind;
  const id = cleanText(body.id, 36, true);
  if (!validKind(kind) || !id) return jsonError("بيانات العنصر غير صالحة.");
  try {
    const current = await appwrite(`/tablesdb/${DATABASE_ID}/tables/${TABLES[kind]}/rows/${encodeURIComponent(id)}`);
    const currentData = current.data && typeof current.data === "object" ? current.data as Record<string, unknown> : current;
    if (!current.$id || currentData.tenant_id !== admin.tenantId) return jsonError("العنصر غير موجود.", 404);
    // Archive instead of hard-delete to preserve references and order history.
    const field = kind === "categories" ? "is_active" : "is_available";
    const result = await appwrite(
      `/tablesdb/${DATABASE_ID}/tables/${TABLES[kind]}/rows/${encodeURIComponent(id)}`,
      { method: "PATCH", body: JSON.stringify({ data: { [field]: false } }) }
    );
    return NextResponse.json({ success: true, row: result });
  } catch (error) {
    return handleError(error);
  }
}
