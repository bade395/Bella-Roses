import { Account, Client, Storage, TablesDB } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

export const appwriteClient =
  endpoint && projectId
    ? new Client().setEndpoint(endpoint).setProject(projectId)
    : null;

export const account = appwriteClient ? new Account(appwriteClient) : null;
export const tablesDB = appwriteClient ? new TablesDB(appwriteClient) : null;
export const storage = appwriteClient ? new Storage(appwriteClient) : null;

export const APPWRITE_DATABASE_ID =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "bella_roses";

export const APPWRITE_MENU_BUCKET_ID =
  process.env.NEXT_PUBLIC_APPWRITE_MENU_BUCKET_ID ?? "menu_images";

export const ADMIN_EMAIL = "temp19952@gmail.com";

export const APPWRITE_TABLES = {
  categories: "categories",
  products: "products",
  restaurantTables: "restaurant_tables",
  orders: "orders",
  orderItems: "order_items",
  settings: "restaurant_settings",
} as const;
