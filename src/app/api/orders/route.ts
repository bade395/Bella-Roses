import { NextResponse } from "next/server";
import { randomBytes, randomUUID } from "node:crypto";
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";
const MAX_ITEMS = 30;

type ProductRow = {
  $id: string;
  category_id: string;
  name_ar: string;
  name_en: string;
  price: number;
  is_available?: boolean;
};

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function queryParam(query: Record<string, unknown>) {
  return `queries[]=${encodeURIComponent(JSON.stringify(query))}`;
}

async function appwrite(path: string, init: RequestInit = {}) {
  const key = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !key) throw new Error("CONFIG");
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
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  return { response, payload };
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return error("طلب غير مسموح.", 403);

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return error("بيانات الطلب غير صالحة."); }

  const token = text(body.table_token, 64);
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return error("امسح رمز QR الخاص بالطاولة أولًا.", 400);
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > MAX_ITEMS) {
    return error("السلة فارغة أو تحتوي على عدد عناصر غير صالح.");
  }

  const requested = new Map<string, { quantity: number; notes: string }>();
  for (const raw of body.items) {
    if (!raw || typeof raw !== "object") return error("أحد عناصر الطلب غير صالح.");
    const item = raw as Record<string, unknown>;
    const productId = text(item.product_id, 36);
    const quantity = Number(item.quantity);
    if (!/^[A-Za-z0-9._-]{1,36}$/.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return error("تحقق من المنتجات والكميات في السلة.");
    }
    if (requested.has(productId)) return error("يوجد منتج مكرر في السلة.");
    requested.set(productId, { quantity, notes: text(item.notes, 500) });
  }

  const customerName = text(body.customer_name, 120);
  const orderNotes = text(body.notes, 1500);

  try {
    const tableQuery = [
      queryParam({ method: "equal", attribute: "qr_token", values: [token] }),
      queryParam({ method: "equal", attribute: "is_active", values: [true] }),
      queryParam({ method: "limit", values: [1] }),
    ].join("&");
    const tableResult = await appwrite(`/tablesdb/${DATABASE_ID}/tables/restaurant_tables/rows?${tableQuery}`);
    if (!tableResult.response.ok) throw new Error("TABLE_LOOKUP");
    const tableRows = (tableResult.payload.rows ?? []) as Array<{ $id: string; table_number: number; label?: string }>;
    const table = tableRows[0];
    if (!table) return error("رمز الطاولة غير صالح أو أن الطاولة غير مفعّلة.", 404);

    const settingsResult = await appwrite(`/tablesdb/${DATABASE_ID}/tables/restaurant_settings/rows/main`);
    if (!settingsResult.response.ok) throw new Error("SETTINGS_LOOKUP");
    const settings = settingsResult.payload.data as { ordering_enabled?: boolean } | undefined;
    if (settings?.ordering_enabled !== true) return error("الطلب الإلكتروني متوقف حاليًا. يرجى طلب المساعدة من فريق المطعم.", 409);

    const products = await Promise.all([...requested.entries()].map(async ([id, details]) => {
      const result = await appwrite(`/tablesdb/${DATABASE_ID}/tables/products/rows/${encodeURIComponent(id)}`);
      if (!result.response.ok) return null;
      const data = result.payload as unknown as ProductRow;
      return data.$id && data.is_available !== false && Number.isFinite(Number(data.price))
        ? { product: data, ...details }
        : null;
    }));
    if (products.some((item) => !item)) {
      return error("أحد المنتجات لم يعد متاحًا. حدّث القائمة وراجع السلة.", 409);
    }

    const categoryIds = [...new Set(products.map((item) => item!.product.category_id))];
    const categories = await Promise.all(categoryIds.map(async (id) => {
      const result = await appwrite(`/tablesdb/${DATABASE_ID}/tables/categories/rows/${encodeURIComponent(id)}`);
      return result.response.ok ? result.payload as { is_active?: boolean } : null;
    }));
    if (categories.some((category) => !category || category.is_active === false)) {
      return error("أحد تصنيفات المنتجات لم يعد متاحًا. حدّث القائمة وحاول مجددًا.", 409);
    }

    const orderId = randomUUID();
    const orderNumber = `BR-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const itemRows = products.map((entry) => {
      const { product, quantity, notes } = entry!;
      const unitPrice = Math.round(Number(product.price) * 100) / 100;
      return {
        rowId: randomUUID(),
        data: {
          order_id: orderId,
          product_id: product.$id,
          product_name_ar: product.name_ar,
          product_name_en: product.name_en || product.name_ar,
          unit_price: unitPrice,
          quantity,
          line_total: Math.round(unitPrice * quantity * 100) / 100,
          notes,
        },
      };
    });
    const subtotal = Math.round(itemRows.reduce((sum, item) => sum + Number(item.data.line_total), 0) * 100) / 100;

    const transaction = await appwrite("/tablesdb/transactions", {
      method: "POST",
      body: JSON.stringify({ ttl: 60 }),
    });
    if (!transaction.response.ok || typeof transaction.payload.$id !== "string") {
      console.error("Order transaction create failed", { status: transaction.response.status, type: transaction.payload.type });
      throw new Error("TRANSACTION_CREATE");
    }
    const transactionId = transaction.payload.$id;
    const operations = [
      {
        action: "create",
        databaseId: DATABASE_ID,
        tableId: "orders",
        rowId: orderId,
        data: {
          order_number: orderNumber,
          table_id: table.$id,
          status: "new",
          subtotal,
          customer_name: customerName,
          notes: orderNotes,
        },
      },
      ...itemRows.map((item) => ({
        action: "create",
        databaseId: DATABASE_ID,
        tableId: "order_items",
        rowId: item.rowId,
        data: item.data,
      })),
    ];

    const staged = await appwrite(`/tablesdb/transactions/${encodeURIComponent(transactionId)}/operations`, {
      method: "POST",
      body: JSON.stringify({ operations }),
    });
    if (!staged.response.ok) {
      await appwrite(`/tablesdb/transactions/${encodeURIComponent(transactionId)}?commit=false`, { method: "PATCH", body: JSON.stringify({}) });
      console.error("Order transaction staging failed", { status: staged.response.status, type: staged.payload.type });
      throw new Error("TRANSACTION_STAGE");
    }

    const committed = await appwrite(`/tablesdb/transactions/${encodeURIComponent(transactionId)}?commit=true`, {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    if (!committed.response.ok) {
      console.error("Order transaction commit failed", { status: committed.response.status, type: committed.payload.type });
      throw new Error("TRANSACTION_COMMIT");
    }

    return NextResponse.json({
      success: true,
      order: { id: orderId, order_number: orderNumber, table_number: table.table_number, subtotal },
    }, { status: 201 });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "UNKNOWN";
    console.error("Order submission failed", code);
    return error(code === "CONFIG" ? "الخدمة غير متاحة مؤقتًا." : "تعذّر تسجيل الطلب الآن. لم يتم تأكيده؛ حاول مرة أخرى أو اطلب المساعدة.", code === "CONFIG" ? 503 : 502);
  }
}
