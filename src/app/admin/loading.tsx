import { ASICPageSkeleton } from '@/components/asic/ASICTableSkeleton';

/** Content-area loading only — sidebar/header stay mounted in `AdminPortalLayout`. */
export default function Loading() {
  return <ASICPageSkeleton variant="list" />;
}
