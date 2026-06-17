import { useRef } from 'react';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function ExcelImportExportToolbar({
  onExport,
  onTemplate,
  onImportFile,
  exportTestId = 'excel-export-button',
  templateTestId = 'excel-template-button',
  importTestId = 'excel-import-input',
  disabled = false,
}) {
  const t = useTranslation();
  const inputRef = useRef(null);

  async function handleImportChange(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImportFile) return;
    await onImportFile(file);
  }

  return (
    <div className="csv-import-export-toolbar action-row" data-testid="excel-import-export-toolbar">
      <button className="btn btn-secondary" data-testid={templateTestId} disabled={disabled} onClick={onTemplate} type="button">
        {t('excel_download_template')}
      </button>
      <button className="btn btn-secondary" data-testid={exportTestId} disabled={disabled} onClick={onExport} type="button">
        {t('excel_export')}
      </button>
      <label className="btn btn-secondary csv-import-button">
        {t('excel_import')}
        <input
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          data-testid={importTestId}
          disabled={disabled}
          hidden
          onChange={handleImportChange}
          ref={inputRef}
          type="file"
        />
      </label>
    </div>
  );
}
