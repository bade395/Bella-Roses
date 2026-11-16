import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminUser, APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID } from "@/lib/admin-auth";

export const runtime = "nodejs";

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_MENU_BUCKET_ID ?? "menu_images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "مصدر الطلب غير موثوق." }, { status: 403 });
  }
  if (!(await getAdminUser())) {
    return NextResponse.json({ error: "غير مصرح." }, { status: 401 });
  }

  const apiKey = process.env.APPWRITE_API_KEY;
  if (!APPWRITE_ENDPOINT || !APPWRITE_PROJECT_ID || !apiKey) {
    return NextResponse.json({ error: "إعدادات التخزين غير مكتملة." }, { status: 503 });
  }

  let form: FormData;
  try { form = await request.formData(); } catch {
    return NextResponse.json({ error: "تعذّر قراءة الملف." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "اختر صورة أولًا." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "الصيغ المسموحة: JPG وPNG وWebP وAVIF." }, { status: 415 });
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "يجب ألا يتجاوز حجم الصورة 5 ميجابايت." }, { status: 413 });

  const upstream = new FormData();
  upstream.set("fileId", randomUUID());
  upstream.set("file", file, file.name.slice(0, 180));

  try {
    const response = await fetch(`${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files`, {
      method: "POST",
      headers: {
        "X-Appwrite-Project": APPWRITE_PROJECT_ID,
        "X-Appwrite-Key": apiKey,
      },
      body: upstream,
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({})) as { $id?: string; message?: string; type?: string };
    if (!response.ok || !result.$id) {
      console.error("Appwrite menu image upload failed", { status: response.status, type: result.type ?? "unknown" });
      return NextResponse.json({ error: response.status === 401 || response.status === 403 ? "مفتاح Appwrite لا يملك صلاحية رفع الصور." : "فشل رفع الصورة." }, { status: 502 });
    }
    return NextResponse.json({ fileId: result.$id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "تعذّر الاتصال بخدمة الصور." }, { status: 502 });
  }
}
