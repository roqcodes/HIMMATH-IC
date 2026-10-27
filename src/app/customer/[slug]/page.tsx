import { redirect } from 'next/navigation';

export default async function CustomerIndexPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/customer/${slug}/orders`);
}
