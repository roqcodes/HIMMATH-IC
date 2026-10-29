import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';

/** Content-area loading — portal chrome stays in `SlugPortalLayout`. */
export default function Loading() {
  return <ASICPageSkeleton variant="list" />;
}
