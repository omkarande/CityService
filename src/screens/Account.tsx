import { useState } from 'react';
import Icon from '../components/Icon';
import TopBar from '../components/TopBar';
import { reportStore, reporterId } from '../lib/storage';

export default function Account() {
  const [reports, setReports] = useState(reportStore.all());
  const id = reporterId();

  return (
    <>
      <TopBar title="Account" />

      <div className="animate-fade-up flex flex-col gap-md px-margin-mobile pb-lg pt-md">
        <div className="flex items-center gap-md rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-md shadow-soft">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <Icon name="person" />
          </span>
          <div className="min-w-0">
            <p className="text-body-lg font-bold text-on-surface">Anonymous reporter</p>
            <p className="truncate text-body-md text-on-surface-variant">{id}</p>
          </div>
        </div>

        <div className="rounded-xl border border-outline-variant/50 bg-surface-container-lowest p-md shadow-soft">
          <p className="text-body-lg font-bold text-on-surface">Your reports</p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            {reports.length === 0
              ? 'You haven’t reported on any service yet.'
              : `${reports.length} report${reports.length === 1 ? '' : 's'} stored on this device.`}
          </p>

          {reports.length > 0 && (
            <button
              onClick={() => {
                reportStore.clear();
                setReports([]);
              }}
              className="mt-3 rounded-full border border-danger/30 px-4 py-2 text-body-md font-bold text-danger transition-colors hover:bg-danger-container active:scale-95"
            >
              Clear my reports
            </button>
          )}
        </div>

        <div className="rounded-xl border border-warning/30 bg-warning-container p-md">
          <p className="flex items-center gap-2 text-body-lg font-bold text-warning">
            <Icon name="science" size={20} /> Prototype
          </p>
          <p className="mt-1 text-body-md text-on-surface-variant">
            Coverage data in this build is placeholder data written to exercise the interface. It is not researched
            and should not be relied on. Reports you file are stored only in this browser.
          </p>
        </div>
      </div>
    </>
  );
}
