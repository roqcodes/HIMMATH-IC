'use client';

import React, { useMemo, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import EntitySearchSelect from '@/components/ui/EntitySearchSelect';
import { asicBtnOutline, asicBtnPrimary, asicInput } from '@/components/asic/ui';
import { dbBulkImportICSalesAction } from '@/app/actions/icTransferActions';
import { useApp } from '@/context/AppContext';
import { filterCounterpartiesForManagers, filterCounterpartiesForSales, filterWarehousesForAssignableUser } from '@/lib/icTransfer/branchPortalScope';
import { buildCounterpartySearchOptions } from '@/lib/icTransfer/entitySearchOptions';
import { INR_PER_UNIT } from '@/lib/icTransfer/rateCalculations';
import { DEFAULT_IC_SALE_TRANSACTION_TYPE } from '@/lib/icTransfer/transactionTypes';
import type { ICSale } from '@/types';

type ParsedRow = {
  rowNumber: number;
  date: string;
  customerId: string;
  customerName: string;
  sender: string;
  senderManagerId: string;
  senderManagerName: string;
  senderError?: string;
  address: string;
  soldInr: number;
  units: number;
  unitRate: number;
  aedReceived: number;
  error?: string;
};

type ImportFailure = { rowNumber: number; error: string };

const expectedHeaders = ['date', 'particular', 'person', 'sender', 'soldinr', 'rate', 'aedreceived'] as const;
const NO_MANAGER_IDS: string[] = [];

function normalizeHeader(value: unknown): string {
  return String(value ?? '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

function cellValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if ('result' in record) return record.result;
  if ('text' in record) return record.text;
  if (Array.isArray(record.richText)) {
    return record.richText.map(part => String((part as { text?: unknown }).text ?? '')).join('');
  }
  return value;
}

function cellText(value: unknown): string {
  const resolved = cellValue(value);
  return resolved == null ? '' : String(resolved).trim();
}

function parseAmount(value: unknown): number | null {
  const resolved = cellValue(value);
  if (typeof resolved === 'number') return Number.isFinite(resolved) ? resolved : null;
  const text = String(resolved ?? '').trim().replace(/[₹,\s]/g, '');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: unknown): string | null {
  const resolved = cellValue(value);
  if (resolved instanceof Date && Number.isFinite(resolved.getTime())) return resolved.toISOString();
  if (typeof resolved === 'number' && Number.isFinite(resolved)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + resolved * 24 * 60 * 60 * 1000);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  const text = String(resolved ?? '').trim();
  if (!text) return null;
  const localDate = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
  if (localDate) {
    const [, day, month, rawYear] = localDate;
    const shortYear = Number(rawYear);
    const year = rawYear.length === 2 ? (shortYear <= 69 ? 2000 + shortYear : 1900 + shortYear) : shortYear;
    const date = new Date(Date.UTC(year, Number(month) - 1, Number(day), 12));
    if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) return null;
    return date.toISOString();
  }
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

async function buildImportKey(
  fileFingerprint: string,
  rowNumber: number,
  warehouseId: string,
  managerId: string,
): Promise<string> {
  const source = `${fileFingerprint}:${rowNumber}:${warehouseId}:${managerId}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function BulkSalesImportModal({
  open,
  onClose,
  branchId,
  branchSlug,
  onCompleted,
}: {
  open: boolean;
  onClose: () => void;
  branchId?: string;
  branchSlug?: string;
  onCompleted: () => Promise<void>;
}) {
  const { icSuppliers, icWarehouses, user } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [fileFingerprint, setFileFingerprint] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ completed: number; total: number } | null>(null);
  const [fileError, setFileError] = useState('');
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [importedRowNumbers, setImportedRowNumbers] = useState<Set<number>>(new Set());

  const managers = useMemo(
    () => filterCounterpartiesForManagers(icSuppliers, branchId),
    [icSuppliers, branchId],
  );
  const customers = useMemo(
    () => filterCounterpartiesForSales(icSuppliers, branchId),
    [icSuppliers, branchId],
  );
  const customerByName = useMemo(() => {
    const map = new Map<string, typeof customers>();
    for (const customer of customers) {
      const key = normalizeName(customer.name);
      map.set(key, [...(map.get(key) ?? []), customer]);
    }
    return map;
  }, [customers]);
  const managerByName = useMemo(() => {
    const map = new Map<string, typeof managers>();
    for (const manager of managers) {
      const key = normalizeName(manager.name);
      map.set(key, [...(map.get(key) ?? []), manager]);
    }
    return map;
  }, [managers]);
  const warehouses = useMemo(
    () => filterWarehousesForAssignableUser(icWarehouses, user),
    [icWarehouses, user],
  );
  const selectedWarehouse = useMemo(
    () => warehouses.find(warehouse => warehouse.id === warehouseId) ?? null,
    [warehouses, warehouseId],
  );
  const assignedManagerIds = selectedWarehouse?.managerIds ?? NO_MANAGER_IDS;
  const managerRequired = selectedWarehouse?.deskKind === 'branch' || assignedManagerIds.length > 0;
  const branchNeedsManagerAssignment = selectedWarehouse?.deskKind === 'branch' && assignedManagerIds.length === 0;
  const managerOptions = useMemo(
    () => buildCounterpartySearchOptions(
      assignedManagerIds.length > 0
        ? managers.filter(manager => assignedManagerIds.includes(manager.id))
        : managers,
    ),
    [managers, assignedManagerIds],
  );
  const rowError = (row: ParsedRow) => {
    if (row.error) return row.error;
    if (managerId) return '';
    if (row.senderError) return row.senderError;
    if (managerRequired && !row.senderManagerId) return 'Sender must match an existing manager.';
    if (row.senderManagerId && assignedManagerIds.length > 0 && !assignedManagerIds.includes(row.senderManagerId)) {
      return 'Sender manager is not assigned to this warehouse; select a manager for all sales to override.';
    }
    return '';
  };
  const validRows = useMemo(() => rows.filter(row => !rowError(row)), [rows, managerId, managerRequired, assignedManagerIds]);
  const invalidRows = rows.length - validRows.length;
  const pendingRows = useMemo(
    () => validRows.filter(row => !importedRowNumbers.has(row.rowNumber)),
    [validRows, importedRowNumbers],
  );

  const reset = () => {
    setRows([]);
    setFileName('');
    setFileFingerprint('');
    setWarehouseId('');
    setManagerId('');
    setFileError('');
    setFailures([]);
    setImportedCount(null);
    setImportProgress(null);
    setImportedRowNumbers(new Set());
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if ((importedCount ?? 0) > 0) return;
    setIsParsing(true);
    setFileError('');
    setFailures([]);
    setImportedCount(null);
    setImportProgress(null);
    setImportedRowNumbers(new Set());
    setFileName(file.name);
    try {
      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      const fileDigest = await crypto.subtle.digest('SHA-256', buffer);
      setFileFingerprint(Array.from(new Uint8Array(fileDigest), byte => byte.toString(16).padStart(2, '0')).join(''));
      await workbook.xlsx.load(buffer as unknown as Buffer);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error('The workbook has no worksheet.');

      const headerColumns = new Map<string, number>();
      sheet.getRow(1).eachCell((cell, column) => {
        const header = normalizeHeader(cellValue(cell.value));
        if (header) headerColumns.set(header, column);
      });
      const missingHeaders = expectedHeaders.filter(header => !headerColumns.has(header));
      if (missingHeaders.length > 0) {
        throw new Error(`Missing columns: ${missingHeaders.map(header => ({
          date: 'Date', particular: 'Particular', person: 'Person', sender: 'Sender', soldinr: 'Sold INR', rate: 'Rate', aedreceived: 'AED Received',
        }[header])).join(', ')}.`);
      }

      const parsedRows: ParsedRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const read = (header: typeof expectedHeaders[number]) => cellValue(row.getCell(headerColumns.get(header)!).value);
        const rawValues = expectedHeaders.map(read);
        if (rawValues.every(value => cellText(value) === '')) return;

        const date = parseDate(read('date'));
        const particular = cellText(read('particular'));
        const person = cellText(read('person'));
        const sender = cellText(read('sender'));
        const soldInr = parseAmount(read('soldinr'));
        const unitRate = parseAmount(read('rate'));
        const aedReceived = parseAmount(read('aedreceived'));
        const matchingCustomers = customerByName.get(normalizeName(person)) ?? [];
        const matchingManagers = sender ? (managerByName.get(normalizeName(sender)) ?? []) : [];
        let senderError: string | undefined;
        if (sender && matchingManagers.length === 0) senderError = `Manager “${sender}” was not found.`;
        else if (matchingManagers.length > 1) senderError = `Manager name “${sender}” is ambiguous.`;
        let error: string | undefined;
        if (!date) error = 'Invalid or missing Date.';
        else if (!person) error = 'Person is required.';
        else if (matchingCustomers.length === 0) error = `Customer “${person}” was not found.`;
        else if (matchingCustomers.length > 1) error = `Customer name “${person}” is ambiguous; match the name to one existing customer.`;
        else if (soldInr == null || soldInr <= 0) error = 'Sold INR must be greater than zero.';
        else if (unitRate == null || unitRate <= 0) error = 'Rate must be greater than zero.';
        else if (aedReceived == null || aedReceived <= 0) error = 'AED Received must be greater than zero.';

        parsedRows.push({
          rowNumber,
          date: date ?? '',
          customerId: matchingCustomers.length === 1 ? matchingCustomers[0].id : '',
          customerName: matchingCustomers.length === 1 ? matchingCustomers[0].name : person,
          sender,
          senderManagerId: matchingManagers.length === 1 ? matchingManagers[0].id : '',
          senderManagerName: matchingManagers.length === 1 ? matchingManagers[0].name : sender,
          senderError,
          address: particular,
          soldInr: soldInr ?? 0,
          units: soldInr == null ? 0 : soldInr / INR_PER_UNIT,
          unitRate: unitRate ?? 0,
          aedReceived: aedReceived ?? 0,
          error,
        });
      });
      if (parsedRows.length === 0) throw new Error('No sale rows found below the header row.');
      if (parsedRows.length > 500) throw new Error('Import is limited to 500 sales at a time.');
      setRows(parsedRows);
    } catch (error) {
      setRows([]);
      setFileError(error instanceof Error ? error.message : 'Could not read this XLSX file.');
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!warehouseId || branchNeedsManagerAssignment || pendingRows.length === 0 || invalidRows > 0 || isImporting) return;
    setIsImporting(true);
    setFailures([]);
    setFileError('');
    setImportProgress({ completed: 0, total: pendingRows.length });
    try {
      const importedRows: Array<{
        rowNumber: number;
        sale: Omit<ICSale, 'id' | 'enteredBy' | 'enteredByName' | 'enteredByUserId'>;
        importKey: string;
      }> = await Promise.all(pendingRows.map(async row => {
        const rowManagerId = managerId || row.senderManagerId;
        return {
          rowNumber: row.rowNumber,
          importKey: await buildImportKey(fileFingerprint, row.rowNumber, warehouseId, rowManagerId),
          sale: {
            customerName: row.customerName,
            orderCustomerName: row.customerName,
            counterpartyId: row.customerId,
            managerId: rowManagerId || undefined,
            warehouseId,
            transactionType: DEFAULT_IC_SALE_TRANSACTION_TYPE,
            settlementMode: 'cash',
            units: row.units,
            unitRate: row.unitRate,
            aedAmount: row.aedReceived,
            serviceCharge: 0,
            address: row.address || undefined,
            createdAt: row.date,
            priority: 'Normal',
          },
        };
      }));
      const batchSize = 10;
      const allFailures: ImportFailure[] = [];
      let totalImported = 0;
      for (let offset = 0; offset < importedRows.length; offset += batchSize) {
        const batch = importedRows.slice(offset, offset + batchSize);
        const result = await dbBulkImportICSalesAction(batch, branchSlug);
        if (!result.success || !result.data) {
          setFileError(`Stopped after ${offset} of ${importedRows.length} rows: ${result.error || 'Bulk import failed.'}`);
          break;
        }
        totalImported += result.data.imported;
        allFailures.push(...result.data.failures);
        setImportedCount(current => (current ?? 0) + result.data!.imported);
        setImportedRowNumbers(current => new Set([...current, ...result.data!.importedRows]));
        setImportProgress({ completed: Math.min(offset + batch.length, importedRows.length), total: importedRows.length });
      }
      setFailures(allFailures);
      if (totalImported > 0) await onCompleted();
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Bulk import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (isImporting) return;
        reset();
        onClose();
      }}
      title="Bulk import sales"
      maxWidth="max-w-4xl w-[min(95vw,56rem)]"
      footer={(
        <>
          <button type="button" className={asicBtnOutline} onClick={() => { reset(); onClose(); }} disabled={isImporting}>
            Close
          </button>
          <button
            type="button"
            className={asicBtnPrimary}
            onClick={() => void handleImport()}
            disabled={isImporting || isParsing || !warehouseId || branchNeedsManagerAssignment || pendingRows.length === 0 || invalidRows > 0}
          >
          {isImporting ? `Importing ${importProgress?.completed ?? 0}/${importProgress?.total ?? pendingRows.length}…` : pendingRows.length > 0 ? `${importedCount ? 'Retry' : 'Import'} ${pendingRows.length} sales` : 'Import finished'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
          Upload an XLSX with columns <strong>Date, Particular, Person, Sender, Sold INR, Rate, AED Received</strong>.
          Particular is saved as the address. Person must match an existing customer; Sender must match an existing manager unless you choose a manager for all sales, which overrides Sender.
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Warehouse *
            <select className={`${asicInput} mt-1 w-full`} value={warehouseId} onChange={event => { setWarehouseId(event.target.value); setManagerId(''); }} disabled={isImporting}>
              <option value="">Select warehouse</option>
              {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.code ? `${warehouse.code} · ` : ''}{warehouse.name}</option>)}
            </select>
          </label>
          <div className="text-sm font-medium text-slate-700">
            Manager for all sales {managerRequired ? '*' : <span className="font-normal text-slate-500">(optional)</span>}
            <div className="mt-1">
              <EntitySearchSelect
                options={managerOptions}
                selectedId={managerId}
                onSelectId={setManagerId}
                placeholder="Search manager…"
                showDetailLine={false}
                disabled={isImporting}
              />
            </div>
          </div>
        </div>
        {branchNeedsManagerAssignment ? (
          <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Assign a manager to this branch before importing sales.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={event => void handleFile(event.target.files?.[0])}
            disabled={isParsing || isImporting || (importedCount ?? 0) > 0}
          />
          <button type="button" className={asicBtnOutline} onClick={() => fileRef.current?.click()} disabled={isParsing || isImporting || (importedCount ?? 0) > 0}>
            {isParsing ? 'Reading workbook…' : rows.length > 0 ? 'Choose another XLSX' : 'Choose XLSX'}
          </button>
          {fileName ? <span className="text-sm text-slate-600">{fileName}</span> : null}
          {rows.length > 0 ? <span className="text-sm text-slate-600">{rows.length} rows · {validRows.length} ready · {invalidRows} with errors</span> : null}
        </div>

        {fileError ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fileError}</p> : null}

        {importProgress ? (
          <div role="status" aria-live="polite" className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-600">
              <span>{isImporting ? 'Importing sales and syncing ledgers' : 'Upload progress'}</span>
              <span>{importProgress.completed} / {importProgress.total} rows</span>
            </div>
            <progress className="h-2 w-full accent-emerald-600" max={importProgress.total} value={importProgress.completed} />
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr><th className="px-2 py-2">Excel row</th><th className="px-2 py-2">Date</th><th className="px-2 py-2">Particular / address</th><th className="px-2 py-2">Person</th><th className="px-2 py-2">Sender / manager</th><th className="px-2 py-2 text-right">Sold INR</th><th className="px-2 py-2 text-right">Rate</th><th className="px-2 py-2 text-right">AED</th><th className="px-2 py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(row => (
                  <tr key={row.rowNumber}>
                    <td className="px-2 py-1.5 tabular-nums">{row.rowNumber}</td>
                    <td className="px-2 py-1.5">{row.date ? new Date(row.date).toLocaleDateString() : '—'}</td>
                    <td className="px-2 py-1.5">{row.address || '—'}</td>
                    <td className="px-2 py-1.5">{row.customerName || '—'}</td>
                    <td className="px-2 py-1.5">{managerId ? `${managers.find(manager => manager.id === managerId)?.name ?? 'Selected manager'} (all)` : row.senderManagerName || row.sender || '—'}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.soldInr.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.unitRate.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{row.aedReceived.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className={`max-w-64 px-2 py-1.5 ${rowError(row) ? 'text-red-700' : 'text-emerald-700'}`}>{rowError(row) || 'Ready'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {importedCount != null ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Imported {importedCount} sale{importedCount === 1 ? '' : 's'}.
            {failures.length > 0 ? <span className="ml-1 text-red-700">{failures.length} issue{failures.length === 1 ? '' : 's'} need attention.</span> : null}
          </div>
        ) : null}
        {failures.length > 0 ? (
          <ul className="max-h-32 list-disc space-y-1 overflow-auto pl-5 text-xs text-red-700">
            {failures.map((failure, index) => <li key={`${failure.rowNumber}-${index}`}>{failure.rowNumber ? `Row ${failure.rowNumber}: ` : ''}{failure.error}</li>)}
          </ul>
        ) : null}
      </div>
    </Modal>
  );
}
