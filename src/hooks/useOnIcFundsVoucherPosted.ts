import { useEffect, useRef } from 'react';
import {
  subscribeIcFundsVoucherPosted,
  type IcFundsVoucherPostedDetail,
} from '@/lib/icFunds/voucherPostedNotify';

export function useOnIcFundsVoucherPosted(
  onPosted: (detail?: IcFundsVoucherPostedDetail) => void,
): void {
  const onPostedRef = useRef(onPosted);
  onPostedRef.current = onPosted;

  useEffect(() => {
    return subscribeIcFundsVoucherPosted(detail => onPostedRef.current(detail));
  }, []);
}
