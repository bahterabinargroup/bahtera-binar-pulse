import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

// Halaman yang boleh dibuka tanpa login.
const PUBLIC_PATHS = ["/login", "/lupa-password", "/auth", "/cek-persiapan", "/terima-undangan", "/panduan"];

function isPublic(pathname: string) {
  // /dev hanya ada saat pengembangan lokal (halaman itu sendiri menolak di versi tayang).
  const paths = process.env.NODE_ENV === "development" ? [...PUBLIC_PATHS, "/dev"] : PUBLIC_PATHS;
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Menyegarkan sesi login di cookie pada setiap permintaan, lalu mengarahkan
// pengunjung yang belum login ke /login. Ini hanya kenyamanan tampilan;
// perlindungan data tetap dilakukan RLS di database.
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  if (!env) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // Jangan menaruh kode lain di antara createServerClient dan getClaims.
  const { data } = await supabase.auth.getClaims();
  const loggedIn = !!data?.claims;
  const { pathname, search } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    // Bawa cookie sesi yang baru disegarkan.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!loggedIn && !isPublic(pathname)) {
    const redirect = redirectTo("/login");
    if (pathname !== "/") {
      redirect.headers.set(
        "location",
        `${redirect.headers.get("location")}?next=${encodeURIComponent(pathname + search)}`,
      );
    }
    return redirect;
  }

  if (loggedIn && (pathname === "/login" || pathname === "/lupa-password")) {
    return redirectTo("/");
  }

  return response;
}
