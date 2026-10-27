import { redirect } from 'next/navigation';

export default async function CollectionPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/collection/${slug}/fx-settlements`);
}
