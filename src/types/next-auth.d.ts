import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "ADMIN" | "OWNER" | "EMPLOYEE";
    ownerId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "OWNER" | "EMPLOYEE";
      ownerId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: "ADMIN" | "OWNER" | "EMPLOYEE";
    ownerId?: string | null;
  }
}
