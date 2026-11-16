import { Client } from "appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

export const appwriteClient =
  endpoint && projectId
    ? new Client().setEndpoint(endpoint).setProject(projectId)
    : null;
