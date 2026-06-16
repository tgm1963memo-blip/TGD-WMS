import { useRef } from 'react';
import { useTranslation } from '../../i18n/languageProvider.jsx';

export function CsvImportExportToolbar({
  onExport,
  onTemplate,
  onImportFile,
  exportTestId = 'csv-export-button',
  templateTestId = 'csv-template-button',
  importTestId = 'csv-import-input',
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
    <div className="csv-import-export-toolbar action-row" data-testid="csv-import-export-toolbar">
      <button className="btn btn-secondary" data-testid={templateTestId} disabled={disabled} onClick={onTemplate} type="button">
        {t('csv_download_template')}
      </button>
      <button className="btn btn-secondary" data-testid={exportTestId} disabled={disabled} onClick={onExport} type="button">
        {t('csv_export')}
      </button>
      <label className="btn btn-secondary csv-import-button">
        {t('csv_import')}
        <input
          accept=".csv,text/csv"
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
