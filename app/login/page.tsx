import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/training");

  const appleConfigured = Boolean(process.env.AUTH_APPLE_ID);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-[60px] font-sans text-ink">
      <div className="flex w-[420px] flex-col items-center text-center">
        <div className="mb-5 flex flex-col items-center gap-1.5">
          <div className="font-serif text-[23px] font-semibold tracking-[-0.01em]">
            Versus
          </div>
          <div className="h-[3px] w-7 rounded bg-accent" />
        </div>

        <div className="mb-2.5 font-serif text-[28px] font-semibold leading-[1.15]">
          Heureux de vous revoir !
        </div>

        <div className="mt-2 flex w-full flex-col gap-3">
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/training" });
            }}
          >
            <button
              type="submit"
              className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg border border-border-strong bg-white p-3.5 text-[14.5px] font-semibold text-ink-soft"
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.66z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.94-2.9l-3.88-3.02c-1.08.72-2.46 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.28v3.11A12 12 0 0 0 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.29 14.29a7.2 7.2 0 0 1 0-4.58V6.6H1.28a12 12 0 0 0 0 10.8z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.6l4.01 3.11C6.23 6.87 8.88 4.75 12 4.75z"
                />
              </svg>
              Continuer avec Google
            </button>
          </form>

          {appleConfigured ? (
            <form
              action={async () => {
                "use server";
                await signIn("apple", { redirectTo: "/training" });
              }}
            >
              <button
                type="submit"
                className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-ink p-3.5 text-[14.5px] font-semibold text-white"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.25 7.31c1.36.07 2.31.75 3.11.8.85.06 1.71-.13 2.85-.9 1.16.79 1.87 1.55 2.32 2.61-2.87 1.63-2.42 5.24.4 6.4-.34 1.09-.8 2.05-.88 2.06zM12.03 7.25c-.15-2.23 1.66-4.24 3.75-4.25.29 2.58-2.19 4.6-3.75 4.25z" />
                </svg>
                Continuer avec Apple
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-6 text-xs leading-[1.6] text-muted-light">
          En vous connectant avec Google ou Apple, vous acceptez les{" "}
          <span className="underline">Conditions générales</span> et la{" "}
          <span className="underline">Politique de confidentialité</span> de Versus.
        </div>
      </div>
    </div>
  );
}
