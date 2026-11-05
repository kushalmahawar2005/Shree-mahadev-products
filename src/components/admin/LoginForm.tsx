import Image from "next/image";
import { LoginFields } from "./LoginFields";

export async function LoginForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const n = (await searchParams).next;
  return (
    <div className="relative w-full max-w-[400px] rounded-3xl bg-surface p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-9">
      <div className="flex flex-col items-center text-center">
        <Image
          src="https://res.cloudinary.com/bmqxsylj/image/upload/v1793735979/swadeshi-mahadev/static/logo.png"
          alt="Swadeshi Mahadev Products"
          width={72}
          height={72}
          priority
          unoptimized
          className="size-[72px]"
        />
        <h1 className="mt-4 text-2xl text-forest-text">Admin login</h1>
        <p className="mt-1 text-sm text-ink-muted">Orders, products, shipping and banners.</p>
      </div>
      <LoginFields next={typeof n === "string" ? n : ""} />
      <p className="mt-6 text-center text-xs text-ink-muted">Only for the Swadeshi Mahadev team.</p>
    </div>
  );
}
