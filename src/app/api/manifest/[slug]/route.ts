import { NextResponse } from 'next/server';
import { PRODUCT_DESCRIPTION, PRODUCT_NAME } from '@/lib/brand';

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  
  // Format slug into a friendly name (e.g. aibak-office -> Aibak Office)
  const branchName = slug.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  const manifest = {
    name: `${branchName} — ${PRODUCT_NAME}`,
    short_name: branchName,
    description: `${PRODUCT_NAME} — ${PRODUCT_DESCRIPTION} (${branchName}).`,
    start_url: `/${slug}`,
    scope: `/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/logo.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };

  return NextResponse.json(manifest);
}
