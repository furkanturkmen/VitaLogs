// src/components/upload/HealthUpload.js
import { useState } from 'react';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import supabase from '../../lib/supabaseClient';

export default function HealthUpload({ user }) {
  const [status, setStatus] = useState('No file uploaded yet');

  const handleUpload = async (file) => {
    setStatus('Processing file...');
    try {
      const zip = await JSZip.loadAsync(file);
      const xml = await zip.file('export.xml')?.async('string');

      if (!xml) {
        setStatus('❌ export.xml not found in ZIP file.');
        return;
      }

      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(xml);
      const records = parsed.HealthData?.Record ?? [];

      const steps = records
        .filter((r) => r['@_type'] === 'HKQuantityTypeIdentifierStepCount')
        .map((r) => ({
          user_id: user.id,
          type: r['@_type'],
          value: parseFloat(r['@_value']),
          unit: r['@_unit'],
          start_time: r['@_startDate'],
          end_time: r['@_endDate'],
        }));

      const { error } = await supabase.from('health_data').insert(steps);
      if (error) {
        setStatus(`❌ Upload failed: ${error.message}`);
      } else {
        setStatus(`✅ Uploaded ${steps.length} step records`);
      }
    } catch (err) {
      console.error(err);
      setStatus(`❌ Error processing file`);
    }
  };

  return (
    <div>
      <h2>Upload Health Export</h2>
      <input
        type="file"
        accept=".zip"
        onChange={(e) => handleUpload(e.target.files[0])}
      />
      <p>{status}</p>
    </div>
  );
}
